import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Upload, UserRoundSearch, X } from 'lucide-react';
import {
  CLIENT_DOCUMENT_TYPES,
  createClientSchema,
  updateClientSchema,
  type ClientDocumentType,
  type CreateClientInput,
  type UpdateClientInput,
} from '@car-rental/shared';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ApiClientError } from '@/lib/api-client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import {
  useCheckPhoneDuplicateQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useUploadClientDocumentMutation,
} from '../hooks/use-clients';
import { CLIENT_DOCUMENT_TYPE_LABELS, CLIENT_NATIONALITIES, DEFAULT_CLIENT_NATIONALITY } from '../lib/client-labels';
import { validateClientDocumentFile } from '../lib/client-document-validation';

type ClientFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
  // Scrolls to and focuses this field once the dialog opens — lets a
  // "Renouveler" action (e.g. from the profile sheet's expired-license
  // badge) land the admin directly on the field to fix, instead of a form
  // they have to hunt through themselves.
  focusField?: 'drivingLicenseExpiry';
};

// A document can only be uploaded once the client exists (the endpoint is
// /clients/:id/documents), so on the add form these just sit in a local
// queue — the actual upload happens right after the client is created, in
// onSubmit below. Never shown on the edit form, which already has a real
// document manager (ClientDocumentManagerDialog) for an existing client.
type PendingDocument = {
  localId: string;
  file: File;
  type: ClientDocumentType;
  previewUrl: string;
};

// UTC getters, not local ones — `new Date('YYYY-MM-DD')` parses as UTC
// midnight, so formatting back with local getters could shift the day by
// one in timezones behind UTC. Using UTC both ways keeps the round-trip
// exact regardless of the browser's timezone.
function dateToInputValue(date: Date | null | undefined): string {
  if (!date) return '';
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildDefaultValues(client?: Client): UpdateClientInput {
  if (!client) {
    // New clients default to the agency's own nationality — the vast
    // majority of walk-in clients — rather than starting the picker empty.
    return { nationality: DEFAULT_CLIENT_NATIONALITY };
  }
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    phone: client.phone,
    nationality: client.nationality,
    address: client.address,
    city: client.city,
    nationalIdNumber: client.nationalIdNumber,
    drivingLicenseNumber: client.drivingLicenseNumber,
    drivingLicenseExpiry: client.drivingLicenseExpiry ? new Date(client.drivingLicenseExpiry) : null,
    dateOfBirth: client.dateOfBirth ? new Date(client.dateOfBirth) : null,
    notes: client.notes,
  };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function ClientFormDialog({ open, onOpenChange, client, focusField }: ClientFormDialogProps) {
  const isEdit = Boolean(client);
  const createMutation = useCreateClientMutation();
  const updateMutation = useUpdateClientMutation();
  const uploadDocumentMutation = useUploadClientDocumentMutation();
  const isPending = createMutation.isPending || updateMutation.isPending || uploadDocumentMutation.isPending;

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<UpdateClientInput>({
    resolver: zodResolver(isEdit ? updateClientSchema : createClientSchema) as Resolver<UpdateClientInput>,
    defaultValues: buildDefaultValues(client),
  });

  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [pendingType, setPendingType] = useState<ClientDocumentType>('ID_CARD');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // This dialog stays mounted between opens (ClientsPage always renders it,
  // just toggling `open`) — without this, switching from "Ajouter" to
  // "Modifier" (or between two different clients) would leave whatever was
  // last typed, plus its validation errors, sitting in the form instead of
  // the newly-selected client's actual data.
  useEffect(() => {
    if (open) {
      reset(buildDefaultValues(client));
      setPendingDocuments((prev) => {
        prev.forEach((d) => URL.revokeObjectURL(d.previewUrl));
        return [];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client]);

  // Waits a tick for the dialog's open animation/render to settle before
  // scrolling — focusing immediately on mount can land mid-transition, with
  // the field not actually in view yet.
  useEffect(() => {
    if (!open || !focusField) return;
    const timer = setTimeout(() => {
      document.getElementById(focusField)?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [open, focusField]);

  // Non-blocking duplicate warning — a phone number can legitimately be
  // shared (e.g. family members), so this never prevents saving, unlike the
  // email uniqueness constraint enforced server-side.
  const phoneValue = watch('phone') ?? '';
  const debouncedPhone = useDebouncedValue(phoneValue);
  const { data: phoneMatches } = useCheckPhoneDuplicateQuery(debouncedPhone, client?.id);
  const hasPhoneDuplicate = Boolean(phoneMatches && phoneMatches.length > 0);

  function handlePendingFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateClientDocumentFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setPendingDocuments((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        file,
        type: pendingType,
        previewUrl: URL.createObjectURL(file),
      },
    ]);
  }

  function removePendingDocument(localId: string) {
    setPendingDocuments((prev) => {
      const target = prev.find((d) => d.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((d) => d.localId !== localId);
    });
  }

  async function onSubmit(values: UpdateClientInput) {
    try {
      if (isEdit && client) {
        await updateMutation.mutateAsync({ id: client.id, input: values });
        toast.success('Client mis à jour.');
      } else {
        const newClient = await createMutation.mutateAsync(values as CreateClientInput);

        // Documents can only be uploaded once the client exists — sent
        // sequentially right after creation, not in parallel, so a slow or
        // failing upload never races the next one.
        let failedCount = 0;
        for (const doc of pendingDocuments) {
          try {
            await uploadDocumentMutation.mutateAsync({
              clientId: newClient.id,
              file: doc.file,
              type: doc.type,
            });
          } catch {
            failedCount += 1;
          }
        }

        if (failedCount > 0) {
          toast.warning(
            `Client ajouté, mais ${failedCount} document${failedCount > 1 ? 's' : ''} n'ont pas pu être envoyé${failedCount > 1 ? 's' : ''}. Réessayez depuis sa fiche.`,
          );
        } else {
          toast.success(pendingDocuments.length > 0 ? 'Client et documents ajoutés.' : 'Client ajouté.');
        }
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
              {hasPhoneDuplicate && (
                <div className="col-span-2">
                  <Alert variant="warning">
                    <UserRoundSearch className="h-4 w-4" />
                    <AlertDescription>
                      Un client avec ce numéro existe déjà :{' '}
                      {phoneMatches!.map((m) => `${m.firstName} ${m.lastName}`).join(', ')}.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date de naissance</Label>
                <Controller
                  name="dateOfBirth"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={dateToInputValue(field.value)}
                      onChange={(e) => field.onChange(e.target.value === '' ? null : new Date(e.target.value))}
                    />
                  )}
                />
                {errors.dateOfBirth && (
                  <p className="text-sm text-destructive">{errors.dateOfBirth.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationality">Nationalité</Label>
                <Controller
                  name="nationality"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                      <SelectTrigger id="nationality">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {CLIENT_NATIONALITIES.map((n) => (
                          <SelectItem key={n} value={n}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Adresse & identité
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  {...register('address', { setValueAs: (v) => (v === '' ? null : v) })}
                />
                {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationalIdNumber">N° CIN</Label>
                <Input
                  id="nationalIdNumber"
                  {...register('nationalIdNumber', { setValueAs: (v) => (v === '' ? null : v) })}
                />
                {errors.nationalIdNumber && (
                  <p className="text-sm text-destructive">{errors.nationalIdNumber.message}</p>
                )}
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
                <Controller
                  name="drivingLicenseExpiry"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="drivingLicenseExpiry"
                      type="date"
                      value={dateToInputValue(field.value)}
                      onChange={(e) => field.onChange(e.target.value === '' ? null : new Date(e.target.value))}
                    />
                  )}
                />
              </div>
            </div>
          </div>

          {/* Documents only exist on the add form — editing an existing
              client already has a dedicated document manager (opened via
              "Gérer les documents"), with real uploads instead of a
              pre-creation queue, so this would just duplicate it. Notes has
              no such replacement on this form anymore; it's still shown
              read-only on the profile if a client already has some. */}
          {!isEdit && (
            <>
              <Separator />
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Documents (optionnel)
                </p>

                {pendingDocuments.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {pendingDocuments.map((doc) => (
                      <div key={doc.localId} className="relative overflow-hidden rounded-lg border border-border">
                        <img src={doc.previewUrl} alt="" className="h-24 w-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-background/90 px-2 py-1 text-xs font-medium">
                          {CLIENT_DOCUMENT_TYPE_LABELS[doc.type]}
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="absolute right-2 top-2 h-6 w-6"
                          aria-label="Retirer ce document"
                          onClick={() => removePendingDocument(doc.localId)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
                  <div className="space-y-1.5">
                    <Label>Type de document</Label>
                    <Select value={pendingType} onValueChange={(v) => setPendingType(v as ClientDocumentType)}>
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLIENT_DOCUMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {CLIENT_DOCUMENT_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePendingFileSelected}
                  />
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Ajouter un document
                  </Button>
                </div>
              </div>
            </>
          )}

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
