import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { createRentalSchema, PAYMENT_METHODS, type PaymentMethod } from '@car-rental/shared';

import { ApiClientError } from '@/lib/api-client';
import { useAvailableCarsQuery } from '@/features/cars/hooks/use-cars';
import { useClientsQuery } from '@/features/clients/hooks/use-clients';
import { PAYMENT_METHOD_LABELS } from '@/features/finances/lib/finance-labels';
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

type BookingMode = 'IMMEDIATE' | 'ADVANCE';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

// Local calendar date, not UTC — "today" for the Location immédiate tab
// means the admin's own wall-clock day, same as what a bare <input
// type="date"> shows/expects (YYYY-MM-DD).
function todayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function RentalFormDialog({ open, onOpenChange, onCreated }: RentalFormDialogProps) {
  // Two tabs, not a checkbox or a radio card — "Location immédiate" is the
  // default (first) tab and owns the Paiement section, since collecting
  // money on the spot only really applies to a walk-in client; a
  // "Réservation à l'avance" has nothing to encaisser yet.
  const [bookingMode, setBookingMode] = useState<BookingMode>('IMMEDIATE');
  const [pickupDate, setPickupDate] = useState(() => todayInputValue());
  const [plannedReturnDate, setPlannedReturnDate] = useState('');
  const [carId, setCarId] = useState<string | undefined>(undefined);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const hasDepositAmount = depositAmount !== '' && Number(depositAmount) > 0;

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
  const { data: clientsData } = useClientsQuery({ pageSize: 100 });
  const createMutation = useCreateRentalMutation();

  const selectedCar = availableCars?.find((c) => c.id === carId);
  const nights = datesValid
    ? Math.max(Math.ceil((new Date(plannedReturnDate).getTime() - new Date(pickupDate).getTime()) / MS_PER_DAY), 1)
    : 0;
  const estimatedTotal = selectedCar ? nights * Number(selectedCar.dailyRate) : null;

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
  useEffect(() => {
    if (selectedCar) {
      setMileageAtPickup(String(selectedCar.mileage));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCar?.id]);

  // Only switching TO "Immédiate" acts (prefills today) — switching away is
  // just a declaration, it never clears a date the admin already chose.
  function handleBookingModeChange(mode: BookingMode) {
    setBookingMode(mode);
    if (mode === 'IMMEDIATE') {
      setPickupDate(todayInputValue());
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = createRentalSchema.safeParse({
      carId,
      clientId,
      pickupDate: pickupDate || undefined,
      plannedReturnDate: plannedReturnDate || undefined,
      depositAmount: depositAmount === '' ? undefined : Number(depositAmount),
      initialPayment:
        bookingMode === 'IMMEDIATE' && collectDepositNow && hasDepositAmount
          ? { amount: Number(depositAmount), type: 'DEPOSIT' as const, method: depositMethod }
          : bookingMode === 'IMMEDIATE' && rentalPaymentAmount !== ''
            ? { amount: Number(rentalPaymentAmount), type: 'RENTAL_PAYMENT' as const, method: rentalPaymentMethod }
            : undefined,
      activation:
        bookingMode === 'IMMEDIATE'
          ? {
              mileageAtPickup: mileageAtPickup === '' ? undefined : Number(mileageAtPickup),
              fuelLevelAtPickup,
            }
          : undefined,
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
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
      toast.success(bookingMode === 'IMMEDIATE' ? 'Location créée et activée.' : 'Location créée.');
      onOpenChange(false);
      onCreated?.(rental);
    } catch (err) {
      toast.error(errorMessage(err, 'Erreur lors de la création.'));
    }
  }

  return (
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

            <div className="space-y-2">
              <Label required>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clientsData?.items.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <span className="flex items-center gap-2">
                        {client.firstName} {client.lastName}
                        <span className="text-muted-foreground">— {client.phone}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.clientId && <p className="text-sm text-destructive">{fieldErrors.clientId}</p>}
            </div>

            {/* Only "Location immédiate" hands the car over right now — a
                reservation for later has no odometer/carburant reading to
                take yet. RentalsService.create() uses these to activate the
                rental atomically, exactly like ActivateRentalDialog would. */}
            {bookingMode === 'IMMEDIATE' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mileageAtPickup" required>
                    Kilométrage au départ
                  </Label>
                  <Input
                    id="mileageAtPickup"
                    type="number"
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
                {nights} nuit{nights > 1 ? 's' : ''} × {Number(selectedCar!.dailyRate).toLocaleString('fr-TN')} DT ={' '}
                <span className="font-semibold">{estimatedTotal.toLocaleString('fr-TN')} DT</span>
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
              {bookingMode === 'IMMEDIATE' && hasDepositAmount && (
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

            {bookingMode === 'IMMEDIATE' && (
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
  );
}
