import { useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useRentalsQuery } from '@/features/rentals/hooks/use-rentals';

type CarRentedNoticeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carId: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-TN');
}

// The only way to change a rented car's status is closing its rental first
// (RentalsService.returnRental, with the "État de la voiture après retour"
// field) — this dialog informs the admin and hands them off to that rental
// instead of letting the Cars module change the status on its own, which
// would leave the rental record (calendar, history, finance) stale.
export function CarRentedNoticeDialog({ open, onOpenChange, carId }: CarRentedNoticeDialogProps) {
  const navigate = useNavigate();
  const { data } = useRentalsQuery({ carId, status: 'ACTIVE', pageSize: 1 }, { enabled: open });
  const activeRental = data?.items[0];

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Voiture actuellement en location"
      description={
        activeRental
          ? `${activeRental.rentalNumber} — ${activeRental.client.firstName} ${activeRental.client.lastName}, retour prévu le ${formatDate(activeRental.plannedReturnDate)}. Pour changer le statut de cette voiture, clôturez d'abord cette location.`
          : "Cette voiture est actuellement en location. Pour changer son statut, clôturez d'abord cette location."
      }
      confirmLabel="Consulter la location"
      onConfirm={() => {
        if (activeRental) navigate(`/rentals?returnRentalId=${activeRental.id}`);
      }}
    />
  );
}
