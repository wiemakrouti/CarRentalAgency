import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { Rental } from '../api/rentals.api';
import { ActivateRentalDialog } from './activate-rental-dialog';
import { CancelRentalDialog } from './cancel-rental-dialog';
import { ReturnRentalDialog } from './return-rental-dialog';
import { ExtendRentalDialog } from './extend-rental-dialog';

type RentalRowActionsProps = {
  rental: Rental;
};

export function RentalRowActions({ rental }: RentalRowActionsProps) {
  const [activateOpen, setActivateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);

  if (rental.status !== 'RESERVED' && rental.status !== 'ACTIVE') {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {rental.status === 'RESERVED' && (
            <>
              <DropdownMenuItem onClick={() => setActivateOpen(true)}>Activer (remise des clés)</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setCancelOpen(true)}>
                Annuler
              </DropdownMenuItem>
            </>
          )}
          {rental.status === 'ACTIVE' && (
            <>
              <DropdownMenuItem onClick={() => setReturnOpen(true)}>Clôturer (retour véhicule)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExtendOpen(true)}>Prolonger</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ActivateRentalDialog open={activateOpen} onOpenChange={setActivateOpen} rental={rental} />
      <CancelRentalDialog open={cancelOpen} onOpenChange={setCancelOpen} rental={rental} />
      <ReturnRentalDialog open={returnOpen} onOpenChange={setReturnOpen} rental={rental} />
      <ExtendRentalDialog open={extendOpen} onOpenChange={setExtendOpen} rental={rental} />
    </>
  );
}
