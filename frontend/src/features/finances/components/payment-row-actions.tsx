import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Payment } from '../api/finances.api';
import { PaymentSettleDialog } from './payment-settle-dialog';

type PaymentRowActionsProps = {
  payment: Payment;
};

export function PaymentRowActions({ payment }: PaymentRowActionsProps) {
  const [settleOpen, setSettleOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setSettleOpen(true)}>Régler / corriger</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PaymentSettleDialog open={settleOpen} onOpenChange={setSettleOpen} payment={payment} />
    </>
  );
}
