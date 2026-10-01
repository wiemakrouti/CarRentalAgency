import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { createRentalSchema, PAYMENT_METHODS, type PaymentMethod } from '@car-rental/shared';

import { ApiClientError } from '@/lib/api-client';
import { useAvailableCarsQuery } from '@/features/cars/hooks/use-cars';
import type { Client } from '@/features/clients/api/clients.api';
import { ClientCombobox } from '@/features/clients/components/client-combobox';
import { ClientFormDialog } from '@/features/clients/components/client-form-dialog';
import { PAYMENT_METHOD_LABELS } from '@/features/finances/lib/finance-labels';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { Rental } from '../api/rentals.api';
import { useCreateRentalMutation } from '../hooks/use-rentals';

type RentalFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Called with the newly created rental right after it's saved — lets the
  // page jump straight to its detail sheet (see RentalsPage) instead of
  // making the admin find it in the list to then add a payment.
  onCreated?: (rental: Rental) => void;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;


function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

// Local calendar date, not UTC — "today" (a pickup on this day is a Location immédiate)
// means the admin's own wall-clock day, same as what a bare <input
// type="date"> shows/expects (YYYY-MM-DD).
type BookingMode = 'IMMEDIATE' | 'ADVANCE';

function todayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function tomorrowInputValue(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDay(value: string): string {
  return new Date(value).toLocaleDateString('fr-TN');
}

// Non-blocking: renting to a client whose permis is (or will be) expired is
// the agency's call, but it should never happen by accident. Compared as
// calendar days (YYYY-MM-DD), the same representation as the date inputs.
function licenseWarning(client: Client | null, pickupDate: string, plannedReturnDate: string): string | null {
  if (!client?.drivingLicenseExpiry || !pickupDate) return null;
  const expiry = client.drivingLicenseExpiry.slice(0, 10);
  if (expiry < pickupDate) {
    return `Le permis de ce client a expiré le ${formatDay(expiry)}.`;
  }
  if (plannedReturnDate && expiry < plannedReturnDate) {
    return `Le permis de ce client expire le ${formatDay(expiry)}, avant la fin de la location.`;
  }
  return null;
}

// Turns what was typed in the client search into a head start for the new
// client's form: a number goes to the phone, otherwise the first word is
// the first name and the rest the last name ("Amine Ben Salah").
function newClientPrefill(search: string): { firstName?: string; lastName?: string; phone?: string } {
  const text = search.trim();
  if (!text) return {};
  if (/^[\d\s+./-]+$/.test(text)) return { phone: text };
  const [firstName, ...rest] = text.split(/\s+/);
  return { firstName, lastName: rest.join(' ') || undefined };
}

export function RentalFormDialog({ open, onOpenChange, onCreated }: RentalFormDialogProps) {
  const [pickupDate, setPickupDate] = useState(() => todayInputValue());
  const [plannedReturnDate, setPlannedReturnDate] = useState('');
  const [carId, setCarId] = useState<string | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);
  // "+ Nouveau client" in the client search opens the regular client form on
  // top of this one; the created (or picked existing) client comes back
  // selected, and everything already filled in here is kept.
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientSearch, setNewClientSearch] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  // "Encaissée maintenant" — a toggle right on the Caution field, not a
  // separate amount input: the amount collected is unambiguously the
  // caution's own value, so there's nothing else to ask for besides how.
  const [collectDepositNow, setCollectDepositNow] = useState(false);
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('CASH');
  // "Paiement du loyer" — a distinct, optional acompte on the rental price
  // itself. Kept mutually exclusive with the deposit toggle above (the
  // backend only accepts one initialPayment at creation time) rather than
  // silently dropping one if both were somehow filled in.
  const [rentalPaymentAmount, setRentalPaymentAmount] = useState('');
  const [rentalPaymentMethod, setRentalPaymentMethod] = useState<PaymentMethod>('CASH');
  // Remise des clés — a walk-in client is handed the car right away, so
  // "Location immédiate" collects the same real-world state an activation
  // would (see ActivateRentalDialog) instead of leaving the rental RESERVED
  // until someone does that as a separate step afterward.
  const [mileageAtPickup, setMileageAtPickup] = useState('');
  const [fuelLevelAtPickup, setFuelLevelAtPickup] = useState('');
  // A price negotiated for this rental only — null means the car's own
  // catalogue rate applies. Never written back to the car: the backend
  // snapshots it onto the rental alongside the catalogue rate.
  const [customDailyRate, setCustomDailyRate] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const hasDepositAmount = depositAmount !== '' && Number(depositAmount) > 0;
  // The pickup date decides (agency rule) and the tabs just follow it: today
  // means the client leaves with the car now — "Location immédiate", created
  // ACTIVE with the remise-des-clés and Paiement sections. Any later date is
  // a "Réservation à l'avance", created RESERVED and activated on the day.
  // (So a reservation for later *today* isn't possible from this form.)
  const isImmediate = pickupDate === todayInputValue();
  const bookingMode: BookingMode = isImmediate ? 'IMMEDIATE' : 'ADVANCE';

  // Clicking a tab moves the pickup date to match it, so tab and date can
  // never disagree: "Immédiate" → today; "À l'avance" → tomorrow if the
  // date was still today (a later date already chosen is kept).
  function handleBookingModeChange(mode: BookingMode) {
    if (mode === 'IMMEDIATE') setPickupDate(todayInputValue());
    else if (isImmediate) setPickupDate(tomorrowInputValue());
  }

  // The toggle only makes sense once there's a caution amount to collect —
  // if the admin clears it (or never set one), silently drop the toggle
  // rather than leave it checked with nothing behind it.
  useEffect(() => {
    if (!hasDepositAmount && collectDepositNow) {
      setCollectDepositNow(false);
    }
  }, [hasDepositAmount, collectDepositNow]);

  function handleToggleCollectDepositNow(checked: boolean) {
    setCollectDepositNow(checked);
    if (checked) setRentalPaymentAmount('');
  }

  function handleRentalPaymentAmountChange(value: string) {
    setRentalPaymentAmount(value);
    if (value !== '') setCollectDepositNow(false);
  }

  const datesValid = Boolean(pickupDate && plannedReturnDate && plannedReturnDate > pickupDate);
  const { data: availableCars, isLoading: isLoadingCars } = useAvailableCarsQuery(pickupDate, plannedReturnDate);
  const createMutation = useCreateRentalMutation();

  const selectedCar = availableCars?.find((c) => c.id === carId);
  const clientLicenseWarning = licenseWarning(client, pickupDate, plannedReturnDate);
  const nights = datesValid
    ? Math.max(Math.ceil((new Date(plannedReturnDate).getTime() - new Date(pickupDate).getTime()) / MS_PER_DAY), 1)
    : 0;
  const catalogDailyRate = selectedCar ? Number(selectedCar.dailyRate) : null;
  const isCustomRate = customDailyRate !== null;
  const customRateValue = isCustomRate && customDailyRate !== '' ? Number(customDailyRate) : null;
  const effectiveDailyRate = isCustomRate ? customRateValue : catalogDailyRate;
  const estimatedTotal =
    selectedCar && effectiveDailyRate !== null && effectiveDailyRate > 0 ? nights * effectiveDailyRate : null;
  const rateDifferencePercent =
    catalogDailyRate && customRateValue && customRateValue !== catalogDailyRate
      ? Math.round(((customRateValue - catalogDailyRate) / catalogDailyRate) * 100)
      : null;

  // Dates changed (or dialog reopened) — the previously selected car may no
  // longer be in the available list, so don't silently keep a stale pick.
  useEffect(() => {
    if (carId && availableCars && !availableCars.some((c) => c.id === carId)) {
      setCarId(undefined);
    }
  }, [availableCars, carId]);

  // Prefills with the selected car's own current mileage — same default
  // ActivateRentalDialog uses — since it's what's actually on the odometer
  // right now; still fully editable if that's a moment out of date.
  // A negotiated price belongs to the car it was negotiated for — picking
  // another car goes back to that car's own catalogue rate.
  useEffect(() => {
    setCustomDailyRate(null);
    if (selectedCar) {
      setMileageAtPickup(String(selectedCar.mileage));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCar?.id]);

  // The dialog stays mounted between openings — a pickup date left from a
  // page open overnight would now be in the past, so bring it back to today.
  useEffect(() => {
    if (open && pickupDate < todayInputValue()) {
      setPickupDate(todayInputValue());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Checks the shared schema can't express: "today" depends on the
    // admin's clock, and the odometer on the car picked. The backend
    // enforces both too — these just catch them right under the field.
    const extraErrors: Record<string, string> = {};
    if (pickupDate && pickupDate < todayInputValue()) {
      extraErrors.pickupDate = "La date de prise en charge ne peut pas être antérieure à aujourd'hui.";
    }
    if (isImmediate && selectedCar && mileageAtPickup !== '' && Number(mileageAtPickup) < selectedCar.mileage) {
      extraErrors['activation.mileageAtPickup'] =
        `Inférieur au compteur de la voiture (${selectedCar.mileage.toLocaleString('fr-TN')} km).`;
    }

    const parsed = createRentalSchema.safeParse({
      carId,
      clientId: client?.id,
      pickupDate: pickupDate || undefined,
      plannedReturnDate: plannedReturnDate || undefined,
      depositAmount: depositAmount === '' ? undefined : Number(depositAmount),
      // Sent only when it actually differs — an unchanged rate is just the
      // catalogue one, which the backend applies by default. An emptied
      // field is sent as 0 so it fails validation instead of silently
      // falling back to the catalogue rate.
      dailyRate: isCustomRate && customRateValue !== catalogDailyRate ? (customRateValue ?? 0) : undefined,
      initialPayment:
        isImmediate && collectDepositNow && hasDepositAmount
          ? { amount: Number(depositAmount), type: 'DEPOSIT' as const, method: depositMethod }
          : isImmediate && rentalPaymentAmount !== ''
            ? { amount: Number(rentalPaymentAmount), type: 'RENTAL_PAYMENT' as const, method: rentalPaymentMethod }
            : undefined,
      activation:
        isImmediate
          ? {
              mileageAtPickup: mileageAtPickup === '' ? undefined : Number(mileageAtPickup),
              fuelLevelAtPickup,
            }
          : undefined,
    });

    if (!parsed.success || Object.keys(extraErrors).length > 0) {
      const errors: Record<string, string> = { ...extraErrors };
      parsed.error?.issues.forEach((issue) => {
        // Nested errors (e.g. initialPayment.amount) join to a dotted key so
        // they can be looked up right under their own input, not lumped
        // under a generic "initialPayment" that no field reads from.
        const key = issue.path.join('.');
        if (key) errors[key] = issue.message;
      });
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    try {
      const rental = await createMutation.mutateAsync(parsed.data);
      toast.success(isImmediate ? 'Location créée et activée.' : 'Location créée.');
      onOpenChange(false);
      onCreated?.(rental);
    } catch (err) {
      toast.error(errorMessage(err, 'Erreur lors de la création.'));
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] max-w-xl flex-col">
          <DialogHeader>
            <DialogTitle>Nouvelle location</DialogTitle>
            <DialogDescription>Choisissez les dates, puis la voiture et le client.</DialogDescription>
          </DialogHeader>

          {/* The footer sits outside this scrolling div, not pinned via
              `position: sticky` inside it — a sticky footer sharing the same
              scroll container as tall content (like the Caution/Paiement
              blocks below) gets visually pulled up over whatever hasn't
              scrolled past it yet, cutting off/overlapping that content
              instead of floating cleanly above it. Splitting the scroll
              region from the footer like this means the footer is simply
              never part of what can overlap — it's always fully visible. */}
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
              <Tabs value={bookingMode} onValueChange={(v) => handleBookingModeChange(v as BookingMode)}>
                {/* h-auto + whitespace-normal override TabsTrigger's default
                    single-line fit: at dialog widths under ~420px, "Réservation
                    à l'avance" doesn't fit half a 2-column row on one line and
                    was overflowing past the dialog edge instead of wrapping. */}
                <TabsList className="grid h-auto w-full grid-cols-2">
                  <TabsTrigger value="IMMEDIATE" className="whitespace-normal py-2 text-center leading-tight">
                    Location immédiate
                  </TabsTrigger>
                  <TabsTrigger value="ADVANCE" className="whitespace-normal py-2 text-center leading-tight">
                    Réservation à l'avance
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pickupDate" required>
                    Date de prise en charge
                  </Label>
                  <Input
                    id="pickupDate"
                    type="date"
                    value={pickupDate}
                    min={todayInputValue()}
                    onChange={(e) => setPickupDate(e.target.value)}
                  />
                  {fieldErrors.pickupDate && <p className="text-sm text-destructive">{fieldErrors.pickupDate}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plannedReturnDate" required>
                    Date de retour prévue
                  </Label>
                  <Input
                    id="plannedReturnDate"
                    type="date"
                    value={plannedReturnDate}
                    min={pickupDate || todayInputValue()}
                    onChange={(e) => setPlannedReturnDate(e.target.value)}
                  />
                  {fieldErrors.plannedReturnDate && (
                    <p className="text-sm text-destructive">{fieldErrors.plannedReturnDate}</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label required>Voiture</Label>
                <Select value={carId} onValueChange={setCarId} disabled={!datesValid || isLoadingCars}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !datesValid
                          ? 'Choisissez d\'abord les dates'
                          : isLoadingCars
                            ? 'Chargement...'
                            : 'Sélectionner une voiture'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCars?.map((car) => (
                      <SelectItem key={car.id} value={car.id}>
                        {car.brand} {car.model} ({car.licensePlate}) — {Number(car.dailyRate).toLocaleString('fr-TN')} DT/jour
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {datesValid && !isLoadingCars && availableCars?.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune voiture disponible pour ces dates.</p>
                )}
                {fieldErrors.carId && <p className="text-sm text-destructive">{fieldErrors.carId}</p>}
              </div>

              {selectedCar && catalogDailyRate !== null && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label htmlFor={isCustomRate ? 'customDailyRate' : undefined}>Tarif journalier</Label>
                      <p className="text-sm text-muted-foreground">
                        Tarif catalogue : {catalogDailyRate.toLocaleString('fr-TN')} DT/jour
                      </p>
                    </div>
                    {isCustomRate ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCustomDailyRate(null)}>
                        Rétablir le tarif d'origine
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCustomDailyRate(String(catalogDailyRate))}
                      >
                        Modifier le tarif
                      </Button>
                    )}
                  </div>
                  {isCustomRate && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Input
                          id="customDailyRate"
                          type="number"
                          step="0.001"
                          min="0"
                          autoFocus
                          className="max-w-[180px]"
                          value={customDailyRate}
                          onChange={(e) => setCustomDailyRate(e.target.value)}
                        />
                        <span className="text-sm text-muted-foreground">DT/jour</span>
                        {rateDifferencePercent !== null && (
                          <span className="text-sm font-medium text-muted-foreground">
                            {rateDifferencePercent > 0 ? '+' : ''}
                            {rateDifferencePercent} %
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        S'applique à cette location uniquement (prolongations et frais de retard inclus) — le tarif
                        de la voiture reste inchangé.
                      </p>
                    </div>
                  )}
                  {fieldErrors.dailyRate && <p className="text-sm text-destructive">{fieldErrors.dailyRate}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="clientId" required>
                  Client
                </Label>
                <ClientCombobox
                  id="clientId"
                  value={client}
                  onChange={setClient}
                  onCreateNew={(search) => {
                    setNewClientSearch(search);
                    setNewClientOpen(true);
                  }}
                />
                {fieldErrors.clientId && <p className="text-sm text-destructive">{fieldErrors.clientId}</p>}
                {clientLicenseWarning && (
                  <Alert variant="warning">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{clientLicenseWarning}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Only "Location immédiate" hands the car over right now — a
                  reservation for later has no odometer/carburant reading to
                  take yet. RentalsService.create() uses these to activate the
                  rental atomically, exactly like ActivateRentalDialog would. */}
              {isImmediate && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mileageAtPickup" required>
                      Kilométrage au départ
                    </Label>
                    <Input
                      id="mileageAtPickup"
                      type="number"
                      min={selectedCar?.mileage ?? 0}
                      value={mileageAtPickup}
                      onChange={(e) => setMileageAtPickup(e.target.value)}
                    />
                    {fieldErrors['activation.mileageAtPickup'] && (
                      <p className="text-sm text-destructive">{fieldErrors['activation.mileageAtPickup']}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fuelLevelAtPickup" required>
                      Niveau de carburant
                    </Label>
                    <Input
                      id="fuelLevelAtPickup"
                      placeholder="Ex. Plein, 3/4, Moitié..."
                      value={fuelLevelAtPickup}
                      onChange={(e) => setFuelLevelAtPickup(e.target.value)}
                    />
                    {fieldErrors['activation.fuelLevelAtPickup'] && (
                      <p className="text-sm text-destructive">{fieldErrors['activation.fuelLevelAtPickup']}</p>
                    )}
                  </div>
                </div>
              )}

              {estimatedTotal !== null && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  {nights} nuit{nights > 1 ? 's' : ''} × {effectiveDailyRate!.toLocaleString('fr-TN')} DT
                  {rateDifferencePercent !== null && (
                    <span className="text-muted-foreground">
                      {' '}
                      (au lieu de {catalogDailyRate!.toLocaleString('fr-TN')} DT)
                    </span>
                  )}{' '}
                  = <span className="font-semibold">{estimatedTotal.toLocaleString('fr-TN')} DT</span>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="depositAmount">Caution</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Montant par défaut de l'agence"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
                {fieldErrors.depositAmount && (
                  <p className="text-sm text-destructive">{fieldErrors.depositAmount}</p>
                )}

                {/* Only "Location immédiate" can encaisser anything on the spot
                    — a reservation for later has nothing to collect yet. */}
                {isImmediate && hasDepositAmount && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label htmlFor="collectDepositNow" className="cursor-pointer">
                          Encaissée maintenant
                        </Label>
                      </div>
                      <Switch
                        id="collectDepositNow"
                        checked={collectDepositNow}
                        onCheckedChange={handleToggleCollectDepositNow}
                        disabled={rentalPaymentAmount !== ''}
                      />
                    </div>
                    {collectDepositNow && (
                      <div className="mt-3 space-y-2">
                        <Label>Méthode</Label>
                        <Select value={depositMethod} onValueChange={(v) => setDepositMethod(v as PaymentMethod)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map((m) => (
                              <SelectItem key={m} value={m}>
                                {PAYMENT_METHOD_LABELS[m]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isImmediate && (
                <div className="space-y-2">
                  <Label>Paiement du loyer</Label>
                  {/* Only one of Caution/loyer can be encaissé at creation — the
                      other is added afterward from the fiche's "+ Ajouter",
                      already préseedé intelligemment for that case. */}
                  <div
                    className={`grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/30 p-3 ${
                      collectDepositNow ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="rentalPaymentAmount">Montant (DT)</Label>
                      <Input
                        id="rentalPaymentAmount"
                        type="number"
                        step="0.001"
                        min="0"
                        disabled={collectDepositNow}
                        value={rentalPaymentAmount}
                        onChange={(e) => handleRentalPaymentAmountChange(e.target.value)}
                      />
                      {fieldErrors['initialPayment.amount'] && (
                        <p className="text-sm text-destructive">{fieldErrors['initialPayment.amount']}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Méthode</Label>
                      <Select
                        value={rentalPaymentMethod}
                        onValueChange={(v) => setRentalPaymentMethod(v as PaymentMethod)}
                        disabled={collectDepositNow}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {PAYMENT_METHOD_LABELS[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Créer la location
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ClientFormDialog
        open={newClientOpen}
        onOpenChange={setNewClientOpen}
        initialValues={newClientPrefill(newClientSearch)}
        onCreated={setClient}
        onUseExisting={setClient}
      />
    </>
  );
}
