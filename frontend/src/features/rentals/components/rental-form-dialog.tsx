import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { createRentalSchema } from '@car-rental/shared';

import { ApiClientError } from '@/lib/api-client';
import { useAvailableCarsQuery } from '@/features/cars/hooks/use-cars';
import { useClientsQuery } from '@/features/clients/hooks/use-clients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useCreateRentalMutation } from '../hooks/use-rentals';

type RentalFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function RentalFormDialog({ open, onOpenChange }: RentalFormDialogProps) {
  const [pickupDate, setPickupDate] = useState('');
  const [plannedReturnDate, setPlannedReturnDate] = useState('');
  const [carId, setCarId] = useState<string | undefined>(undefined);
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [depositAmount, setDepositAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = createRentalSchema.safeParse({
      carId,
      clientId,
      pickupDate: pickupDate || undefined,
      plannedReturnDate: plannedReturnDate || undefined,
      depositAmount: depositAmount === '' ? undefined : Number(depositAmount),
      notes: notes === '' ? null : notes,
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0];
        if (typeof key === 'string') errors[key] = issue.message;
      });
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    try {
      await createMutation.mutateAsync(parsed.data);
      toast.success('Location créée.');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Erreur lors de la création.'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle location</DialogTitle>
          <DialogDescription>Choisissez les dates, puis la voiture et le client.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pickupDate">Date de prise en charge</Label>
              <Input
                id="pickupDate"
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
              />
              {fieldErrors.pickupDate && <p className="text-sm text-destructive">{fieldErrors.pickupDate}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="plannedReturnDate">Date de retour prévue</Label>
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
            <Label>Voiture</Label>
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
            <Label>Client</Label>
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
                      {client.blacklisted && (
                        <Badge variant="destructive" className="pointer-events-none">
                          Liste noire
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.clientId && <p className="text-sm text-destructive">{fieldErrors.clientId}</p>}
          </div>

          {estimatedTotal !== null && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              {nights} nuit{nights > 1 ? 's' : ''} × {Number(selectedCar!.dailyRate).toLocaleString('fr-TN')} DT ={' '}
              <span className="font-semibold">{estimatedTotal.toLocaleString('fr-TN')} DT</span>
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="depositAmount">Dépôt (optionnel)</Label>
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
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
