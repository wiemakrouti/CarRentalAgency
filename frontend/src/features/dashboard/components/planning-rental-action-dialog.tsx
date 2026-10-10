import { useEffect } from 'react';
import { toast } from 'sonner';

import { ActivateRentalDialog } from '@/features/rentals/components/activate-rental-dialog';
import { ExtendRentalDialog } from '@/features/rentals/components/extend-rental-dialog';
import { ReturnRentalDialog } from '@/features/rentals/components/return-rental-dialog';
import { useRentalQuery } from '@/features/rentals/hooks/use-rentals';

export type PlanningRentalAction = { kind: 'return' | 'activate' | 'extend'; rentalId: string };

type PlanningRentalActionDialogProps = {
  action: PlanningRentalAction;
  onClose: () => void;
};

// The planning only holds a light row per rental; the lifecycle dialogs need
// the full record (car mileage, payments...), so it's fetched here first —
// the same dialogs as the Rentals page then run unchanged.
export function PlanningRentalActionDialog({ action, onClose }: PlanningRentalActionDialogProps) {
  const { data: rental, isError } = useRentalQuery(action.rentalId);

  useEffect(() => {
    if (!isError) return;
    toast.error('Impossible de charger la location.');
    onClose();
  }, [isError, onClose]);

  if (!rental) return null;

  const dialogProps = { open: true, rental, onOpenChange: (open: boolean) => !open && onClose() };
  if (action.kind === 'return') return <ReturnRentalDialog {...dialogProps} />;
  if (action.kind === 'activate') return <ActivateRentalDialog {...dialogProps} />;
  return <ExtendRentalDialog {...dialogProps} />;
}
