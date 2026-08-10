import { Controller, useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  createExpenseSchema,
  updateExpenseSchema,
  type CreateExpenseInput,
  type UpdateExpenseInput,
} from '@car-rental/shared';

import { ApiClientError } from '@/lib/api-client';
import { useCarsQuery } from '@/features/cars/hooks/use-cars';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { Expense } from '../api/finances.api';
import { useCreateExpenseMutation, useUpdateExpenseMutation } from '../hooks/use-expenses';
import { EXPENSE_CATEGORY_LABELS } from '../lib/finance-labels';

const NO_CAR_VALUE = '__none__';

type ExpenseFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense;
};

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function buildDefaultValues(expense?: Expense): UpdateExpenseInput {
  if (!expense) {
    return { date: new Date() };
  }
  return {
    category: expense.category,
    amount: Number(expense.amount),
    carId: expense.carId,
    description: expense.description,
    date: new Date(expense.date),
    receiptUrl: expense.receiptUrl,
  };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function ExpenseFormDialog({ open, onOpenChange, expense }: ExpenseFormDialogProps) {
  const isEdit = Boolean(expense);
  const { data: carsData } = useCarsQuery({ pageSize: 100 });
  const createMutation = useCreateExpenseMutation();
  const updateMutation = useUpdateExpenseMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateExpenseInput>({
    resolver: zodResolver(isEdit ? updateExpenseSchema : createExpenseSchema) as Resolver<UpdateExpenseInput>,
    defaultValues: buildDefaultValues(expense),
  });

  async function onSubmit(values: UpdateExpenseInput) {
    try {
      if (isEdit && expense) {
        await updateMutation.mutateAsync({ id: expense.id, input: values });
        toast.success('Dépense mise à jour.');
      } else {
        await createMutation.mutateAsync(values as CreateExpenseInput);
        toast.success('Dépense ajoutée.');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "Erreur lors de l'enregistrement."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier la dépense' : 'Nouvelle dépense'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Mettez à jour les informations de cette dépense.' : "Enregistrez une dépense de l'agence."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
                      {EXPENSE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {EXPENSE_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Montant (DT)</Label>
              <Input id="amount" type="number" step="0.001" {...register('amount', { setValueAs: Number })} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Voiture concernée (optionnel)</Label>
            <Controller
              name="carId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? NO_CAR_VALUE}
                  onValueChange={(value) => field.onChange(value === NO_CAR_VALUE ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Dépense générale" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CAR_VALUE}>Dépense générale (aucune voiture)</SelectItem>
                    {carsData?.items.map((car) => (
                      <SelectItem key={car.id} value={car.id}>
                        {car.brand} {car.model} ({car.licensePlate})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                defaultValue={expense?.date ? toDateInputValue(expense.date) : toDateInputValue(new Date().toISOString())}
                {...register('date', { setValueAs: (v) => (v === '' ? undefined : new Date(v)) })}
              />
              {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="receiptUrl">Justificatif — URL (optionnel)</Label>
              <Input
                id="receiptUrl"
                placeholder="https://..."
                {...register('receiptUrl', { setValueAs: (v) => (v === '' ? null : v) })}
              />
              {errors.receiptUrl && <p className="text-sm text-destructive">{errors.receiptUrl.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={2} {...register('description')} />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
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
