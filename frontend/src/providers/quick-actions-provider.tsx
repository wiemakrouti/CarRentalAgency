import { useMemo, useState, type ReactNode } from 'react';

import { CarFormDialog } from '@/features/cars/components/car-form-dialog';
import { ClientFormDialog } from '@/features/clients/components/client-form-dialog';
import { ExpenseFormDialog } from '@/features/finances/components/expense-form-dialog';
import { PaymentFormDialog } from '@/features/finances/components/payment-form-dialog';
import { RentalDetailSheet } from '@/features/rentals/components/rental-detail-sheet';
import { RentalFormDialog, type RentalFormPrefill } from '@/features/rentals/components/rental-form-dialog';

import { QuickActionsContext, type QuickAction } from './quick-actions-context';

// Mounted once in the app shell: the create forms and the rental sheet live
// here, so any page (the dashboard, the Ctrl+K palette) can open them in
// place. Each dialog is the same component its own module uses — same
// validation, same side effects — just reachable from everywhere.
export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<QuickAction | null>(null);
  const [rentalId, setRentalId] = useState<string | undefined>(undefined);
  const [rentalPrefill, setRentalPrefill] = useState<RentalFormPrefill | undefined>(undefined);

  const value = useMemo(
    () => ({
      openQuickAction: (next: QuickAction) => {
        setRentalPrefill(undefined);
        setAction(next);
      },
      openNewRental: (prefill: RentalFormPrefill) => {
        setRentalPrefill(prefill);
        setAction('rental');
      },
      openRental: (id: string) => setRentalId(id),
    }),
    [],
  );

  const dialogProps = (kind: QuickAction) => ({
    open: action === kind,
    onOpenChange: (open: boolean) => {
      if (!open) setAction(null);
    },
  });

  return (
    <QuickActionsContext.Provider value={value}>
      {children}
      {/* A new rental lands on its own sheet, same as from the Rentals page,
          so a walk-in client's payment is one click away. */}
      <RentalFormDialog
        {...dialogProps('rental')}
        prefill={rentalPrefill}
        onCreated={(rental) => setRentalId(rental.id)}
      />
      <ClientFormDialog {...dialogProps('client')} />
      <CarFormDialog {...dialogProps('car')} />
      <PaymentFormDialog {...dialogProps('payment')} />
      <ExpenseFormDialog {...dialogProps('expense')} />
      <RentalDetailSheet
        rentalId={rentalId}
        open={Boolean(rentalId)}
        onOpenChange={(open) => {
          if (!open) setRentalId(undefined);
        }}
      />
    </QuickActionsContext.Provider>
  );
}
