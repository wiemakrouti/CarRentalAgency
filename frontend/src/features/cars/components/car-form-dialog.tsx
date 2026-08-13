import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  CAR_CATEGORIES,
  CAR_STATUSES,
  FUEL_TYPES,
  TRANSMISSIONS,
  createCarSchema,
  updateCarSchema,
  type CreateCarInput,
  type UpdateCarInput,
} from '@car-rental/shared';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { Car } from '../api/cars.api';
import {
  useCreateCarMutation,
  useUpdateCarMutation,
  useUploadCarImageMutation,
} from '../hooks/use-cars';
import { CarPhotoField } from './car-photo-field';
import {
  CAR_CATEGORY_LABELS,
  CAR_STATUS_LABELS,
  FUEL_TYPE_LABELS,
  TRANSMISSION_LABELS,
} from '../lib/car-labels';

type CarFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  car?: Car;
};

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

function buildDefaultValues(car?: Car): UpdateCarInput {
  if (!car) {
    return { seats: 5, mileage: 0 };
  }
  return {
    licensePlate: car.licensePlate,
    vin: car.vin,
    brand: car.brand,
    model: car.model,
    year: car.year,
    color: car.color,
    category: car.category,
    transmission: car.transmission,
    fuelType: car.fuelType,
    seats: car.seats,
    mileage: car.mileage,
    dailyRate: Number(car.dailyRate),
    purchaseDate: car.purchaseDate ? new Date(car.purchaseDate) : null,
    purchasePrice: car.purchasePrice ? Number(car.purchasePrice) : null,
    insuranceExpiryDate: car.insuranceExpiryDate ? new Date(car.insuranceExpiryDate) : null,
    technicalInspectionExpiryDate: car.technicalInspectionExpiryDate
      ? new Date(car.technicalInspectionExpiryDate)
      : null,
    registrationExpiryDate: car.registrationExpiryDate
      ? new Date(car.registrationExpiryDate)
      : null,
    status: car.status,
  };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function CarFormDialog({ open, onOpenChange, car }: CarFormDialogProps) {
  const isEdit = Boolean(car);
  const createMutation = useCreateCarMutation();
  const updateMutation = useUpdateCarMutation();
  const uploadImageMutation = useUploadCarImageMutation();
  const isPending =
    createMutation.isPending || updateMutation.isPending || uploadImageMutation.isPending;

  // Not a form field — the car has to exist before an image can be
  // associated with it, so this is only ever sent (via the existing Cars
  // image API, isPrimary: true) after the create/update mutation below
  // resolves. Radix unmounts DialogContent on close, so this naturally
  // resets to null each time the dialog reopens, same as react-hook-form's
  // defaultValues below.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const existingImageUrl =
    car?.images.find((img) => img.isPrimary)?.url ?? car?.images[0]?.url ?? null;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateCarInput>({
    resolver: zodResolver(isEdit ? updateCarSchema : createCarSchema) as Resolver<UpdateCarInput>,
    defaultValues: buildDefaultValues(car),
  });

  async function onSubmit(values: UpdateCarInput) {
    let savedCar: Car;
    try {
      if (isEdit && car) {
        savedCar = await updateMutation.mutateAsync({ id: car.id, input: values });
        toast.success('Voiture mise à jour.');
      } else {
        savedCar = await createMutation.mutateAsync(values as CreateCarInput);
        toast.success('Voiture ajoutée.');
      }
    } catch (err) {
      toast.error(errorMessage(err, "Erreur lors de l'enregistrement."));
      return;
    }

    if (photoFile) {
      try {
        await uploadImageMutation.mutateAsync({
          carId: savedCar.id,
          file: photoFile,
          isPrimary: true,
        });
        toast.success('Photo ajoutée.');
      } catch (err) {
        toast.error(
          errorMessage(
            err,
            'La voiture a été enregistrée, mais l\'envoi de la photo a échoué. Réessayez depuis "Gérer les images".',
          ),
        );
      }
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier la voiture' : 'Ajouter une voiture'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Mettez à jour les informations de ce véhicule.'
              : 'Renseignez les informations du nouveau véhicule.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <CarPhotoField
            existingImageUrl={existingImageUrl}
            file={photoFile}
            onFileChange={setPhotoFile}
            disabled={isPending}
          />

          <Separator />

          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Informations générales
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="licensePlate">Immatriculation</Label>
                <Input id="licensePlate" {...register('licensePlate')} />
                {errors.licensePlate && (
                  <p className="text-sm text-destructive">{errors.licensePlate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="vin">VIN (optionnel)</Label>
                <Input
                  id="vin"
                  {...register('vin', { setValueAs: (v) => (v === '' ? null : v) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Marque</Label>
                <Input id="brand" {...register('brand')} />
                {errors.brand && <p className="text-sm text-destructive">{errors.brand.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modèle</Label>
                <Input id="model" {...register('model')} />
                {errors.model && <p className="text-sm text-destructive">{errors.model.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Année</Label>
                <Input id="year" type="number" {...register('year', { setValueAs: Number })} />
                {errors.year && <p className="text-sm text-destructive">{errors.year.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Couleur</Label>
                <Input id="color" {...register('color')} />
                {errors.color && <p className="text-sm text-destructive">{errors.color.message}</p>}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Caractéristiques
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {CAR_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {CAR_CATEGORY_LABELS[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.category && (
                  <p className="text-sm text-destructive">{errors.category.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Transmission</Label>
                <Controller
                  name="transmission"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSMISSIONS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {TRANSMISSION_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.transmission && (
                  <p className="text-sm text-destructive">{errors.transmission.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Carburant</Label>
                <Controller
                  name="fuelType"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {FUEL_TYPES.map((f) => (
                          <SelectItem key={f} value={f}>
                            {FUEL_TYPE_LABELS[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.fuelType && (
                  <p className="text-sm text-destructive">{errors.fuelType.message}</p>
                )}
              </div>
              {isEdit && (
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          {CAR_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {CAR_STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="seats">Places</Label>
                <Input id="seats" type="number" {...register('seats', { setValueAs: Number })} />
                {errors.seats && <p className="text-sm text-destructive">{errors.seats.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mileage">Kilométrage</Label>
                <Input
                  id="mileage"
                  type="number"
                  {...register('mileage', { setValueAs: Number })}
                />
                {errors.mileage && (
                  <p className="text-sm text-destructive">{errors.mileage.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dailyRate">Tarif / jour (DT)</Label>
                <Input
                  id="dailyRate"
                  type="number"
                  step="0.001"
                  {...register('dailyRate', { setValueAs: Number })}
                />
                {errors.dailyRate && (
                  <p className="text-sm text-destructive">{errors.dailyRate.message}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Dates & documents (optionnel)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchaseDate">Date d'achat</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  defaultValue={car?.purchaseDate ? toDateInputValue(car.purchaseDate) : undefined}
                  {...register('purchaseDate', {
                    setValueAs: (v) => (v === '' ? null : new Date(v)),
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Prix d'achat (DT)</Label>
                <Input
                  id="purchasePrice"
                  type="number"
                  step="0.001"
                  {...register('purchasePrice', {
                    setValueAs: (v) => (v === '' ? null : Number(v)),
                  })}
                />
                {errors.purchasePrice && (
                  <p className="text-sm text-destructive">{errors.purchasePrice.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="insuranceExpiryDate">Expiration assurance</Label>
                <Input
                  id="insuranceExpiryDate"
                  type="date"
                  defaultValue={
                    car?.insuranceExpiryDate ? toDateInputValue(car.insuranceExpiryDate) : undefined
                  }
                  {...register('insuranceExpiryDate', {
                    setValueAs: (v) => (v === '' ? null : new Date(v)),
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="technicalInspectionExpiryDate">Expiration contrôle technique</Label>
                <Input
                  id="technicalInspectionExpiryDate"
                  type="date"
                  defaultValue={
                    car?.technicalInspectionExpiryDate
                      ? toDateInputValue(car.technicalInspectionExpiryDate)
                      : undefined
                  }
                  {...register('technicalInspectionExpiryDate', {
                    setValueAs: (v) => (v === '' ? null : new Date(v)),
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registrationExpiryDate">Expiration carte grise</Label>
                <Input
                  id="registrationExpiryDate"
                  type="date"
                  defaultValue={
                    car?.registrationExpiryDate
                      ? toDateInputValue(car.registrationExpiryDate)
                      : undefined
                  }
                  {...register('registrationExpiryDate', {
                    setValueAs: (v) => (v === '' ? null : new Date(v)),
                  })}
                />
              </div>
            </div>
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
