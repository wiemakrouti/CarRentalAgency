import { Controller, useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  createClientSchema,
  updateClientSchema,
  type CreateClientInput,
  type UpdateClientInput,
} from '@car-rental/shared';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { Client } from '../api/clients.api';
import { useCreateClientMutation, useUpdateClientMutation } from '../hooks/use-clients';

type ClientFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
};

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

function buildDefaultValues(client?: Client): UpdateClientInput {
  if (!client) {
    return {};
  }
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    phone: client.phone,
    address: client.address,
    city: client.city,
    nationalIdNumber: client.nationalIdNumber,
    drivingLicenseNumber: client.drivingLicenseNumber,
    drivingLicenseExpiry: client.drivingLicenseExpiry ? new Date(client.drivingLicenseExpiry) : null,
    dateOfBirth: client.dateOfBirth ? new Date(client.dateOfBirth) : null,
    notes: client.notes,
    blacklisted: client.blacklisted,
  };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function ClientFormDialog({ open, onOpenChange, client }: ClientFormDialogProps) {
  const isEdit = Boolean(client);
  const createMutation = useCreateClientMutation();
  const updateMutation = useUpdateClientMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateClientInput>({
    resolver: zodResolver(isEdit ? updateClientSchema : createClientSchema) as Resolver<UpdateClientInput>,
    defaultValues: buildDefaultValues(client),
  });

  async function onSubmit(values: UpdateClientInput) {
    try {
      if (isEdit && client) {
        await updateMutation.mutateAsync({ id: client.id, input: values });
        toast.success('Client mis à jour.');
      } else {
        await createMutation.mutateAsync(values as CreateClientInput);
        toast.success('Client ajouté.');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "Erreur lors de l'enregistrement."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le client' : 'Ajouter un client'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Mettez à jour les informations de ce client.' : 'Renseignez les informations du nouveau client.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Informations personnelles
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" {...register('firstName')} />
                {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" {...register('lastName')} />
                {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" {...register('phone')} />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (optionnel)</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email', { setValueAs: (v) => (v === '' ? null : v) })}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date de naissance (optionnel)</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  defaultValue={client?.dateOfBirth ? toDateInputValue(client.dateOfBirth) : undefined}
                  {...register('dateOfBirth', { setValueAs: (v) => (v === '' ? null : new Date(v)) })}
                />
              </div>
              {isEdit && (
                <div className="flex items-center justify-between rounded-lg border border-border px-3">
                  <Label htmlFor="blacklisted" className="font-normal">
                    Liste noire
                  </Label>
                  <Controller
                    name="blacklisted"
                    control={control}
                    render={({ field }) => (
                      <Switch id="blacklisted" checked={field.value ?? false} onCheckedChange={field.onChange} />
                    )}
                  />
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Adresse & identité
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Adresse (optionnel)</Label>
                <Input
                  id="address"
                  {...register('address', { setValueAs: (v) => (v === '' ? null : v) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville (optionnel)</Label>
                <Input id="city" {...register('city', { setValueAs: (v) => (v === '' ? null : v) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationalIdNumber">N° CIN (optionnel)</Label>
                <Input
                  id="nationalIdNumber"
                  {...register('nationalIdNumber', { setValueAs: (v) => (v === '' ? null : v) })}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Permis de conduire
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="drivingLicenseNumber">Numéro de permis</Label>
                <Input id="drivingLicenseNumber" {...register('drivingLicenseNumber')} />
                {errors.drivingLicenseNumber && (
                  <p className="text-sm text-destructive">{errors.drivingLicenseNumber.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="drivingLicenseExpiry">Date d'expiration (optionnel)</Label>
                <Input
                  id="drivingLicenseExpiry"
                  type="date"
                  defaultValue={
                    client?.drivingLicenseExpiry ? toDateInputValue(client.drivingLicenseExpiry) : undefined
                  }
                  {...register('drivingLicenseExpiry', { setValueAs: (v) => (v === '' ? null : new Date(v)) })}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea
              id="notes"
              rows={3}
              {...register('notes', { setValueAs: (v) => (v === '' ? null : v) })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
