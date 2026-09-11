import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Undo2 } from 'lucide-react';
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
  // Pre-selects (but doesn't lock) the "Voiture concernée" field — used when
  // this dialog is opened from a car's own detail sheet, so the admin isn't
  // stuck picking the same car back out of a 100+ entry dropdown. Ignored in
  // edit mode, where the expense's own carId already wins.
  defaultCarId?: string;
};

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

// `date` is kept as a plain "yyyy-MM-dd" string here — the format the native
// <input type="date"> actually displays — rather than a Date object. Zod's
// `z.coerce.date()` on the schema turns it into a real Date at submit time;
// storing a Date object in RHF's own state instead makes the date input
// render blank, since its DOM value has to be that exact string format.
function buildDefaultValues(expense?: Expense, defaultCarId?: string): UpdateExpenseInput {
  if (!expense) {
    return { date: toDateInputValue(new Date().toISOString()) as unknown as Date, carId: defaultCarId ?? null };
  }
  return {
    category: expense.category,
    amount: Number(expense.amount),
    carId: expense.carId,
    description: expense.description,
    date: toDateInputValue(expense.date) as unknown as Date,
    receiptUrl: expense.receiptUrl,
  };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function ExpenseFormDialog({ open, onOpenChange, expense, defaultCarId }: ExpenseFormDialogProps) {
  const isEdit = Boolean(expense);
  const { data: carsData } = useCarsQuery({ pageSize: 100 });
  const createMutation = useCreateExpenseMutation();
  const updateMutation = useUpdateExpenseMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UpdateExpenseInput>({
    resolver: zodResolver(isEdit ? updateExpenseSchema : createExpenseSchema) as Resolver<UpdateExpenseInput>,
    defaultValues: buildDefaultValues(expense, defaultCarId),
  });

  // This dialog stays mounted in ExpensesTab the whole time (only `open`
  // toggles Radix's own visibility) — `useForm`'s defaultValues are only
  // read once, at that first mount, so without this the form would keep
  // showing whatever expense (or blank "create") state was loaded the very
  // first time the dialog opened, no matter which row is edited next.
  // Re-running on every open (not just when `expense` changes) also covers
  // opening "Nouvelle dépense" twice in a row, where `expense` stays
  // `undefined` both times.
  useEffect(() => {
    if (open) reset(buildDefaultValues(expense, defaultCarId));
  }, [open, expense, defaultCarId, reset]);

  // "Personnalisé" (stored as 'OTHER') is the one category with no fixed
  // meaning of its own — instead of a label, its slot becomes a free-text
  // input naming the expense, stored in `description` (enforced schema-side
  // too, see requireDescriptionForOther).
  const isOtherCategory = watch('category') === 'OTHER';

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
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier la dépense' : 'Nouvelle dépense'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Mettez à jour les informations de cette dépense.' : "Enregistrez une dépense de l'agence."}
          </DialogDescription>
        </DialogHeader>

        {/* The footer sits outside this scrolling div — a sticky footer
            sharing the same scroll container as tall content gets visually
            pulled up over whatever hasn't scrolled past it yet, overlapping
            it instead of floating cleanly above it (see rental-form-dialog). */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label required>Catégorie</Label>
              {isOtherCategory ? (
                // "Personnalisé" swaps the select for a plain text input, in
                // the same slot — the category stays 'OTHER' underneath, the
                // typed name is stored in `description` (unchanged schema).
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="Nommer la dépense"
                    {...register('description')}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    title="Choisir une autre catégorie"
                    onClick={() => {
                      setValue('category', undefined as unknown as UpdateExpenseInput['category']);
                      setValue('description', '');
                    }}
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Controller
                  name="category"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(next) => field.onChange(next)}
                    >
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
              )}
              {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
              {isOtherCategory && errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount" required>
                Montant (DT)
              </Label>
              <Input id="amount" type="number" step="0.001" {...register('amount', { setValueAs: Number })} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Voiture concernée</Label>
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

          <div className="space-y-2">
            <Label htmlFor="date" required>
              Date
            </Label>
            <Input id="date" type="date" {...register('date')} />
            {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
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
