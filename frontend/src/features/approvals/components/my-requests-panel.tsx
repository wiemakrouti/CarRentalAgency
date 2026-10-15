import { toast } from 'sonner';
import { Inbox } from 'lucide-react';
import type { ApprovalStatus } from '@car-rental/shared';

import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api-client';
import { useFormatMoney } from '@/hooks/use-format-money';
import { Button } from '@/components/ui/button';

import type { ApprovalRequest } from '../api/approvals.api';
import { useWithdrawMutation } from '../hooks/use-approvals';
import { APPROVAL_STATUS_LABELS, describeApproval } from '../lib/describe-approval';

const STATUS_STYLE: Record<ApprovalStatus, string> = {
  PENDING: 'bg-warning/15 text-warning-foreground dark:text-warning',
  APPROVED: 'bg-success/15 text-green-700 dark:text-success',
  REJECTED: 'bg-destructive/15 text-red-700 dark:text-destructive',
  WITHDRAWN: 'bg-muted text-muted-foreground',
};

function ago(value: string): string {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `il y a ${hours} h` : `il y a ${Math.round(hours / 24)} j`;
}

type MyRequestsPanelProps = {
  requests: ApprovalRequest[];
  // Decisions the employee hadn't seen when the bell opened — marked "new".
  unseenIds: Set<string>;
};

// The employee's side of the director's approval: what they asked for, and
// the answer. A request still waiting can be taken back.
export function MyRequestsPanel({ requests, unseenIds }: MyRequestsPanelProps) {
  const formatMoney = useFormatMoney();
  const withdraw = useWithdrawMutation();

  async function handleWithdraw(id: string) {
    try {
      await withdraw.mutateAsync(id);
      toast.success('Demande retirée.');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Impossible de retirer la demande.');
    }
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Inbox className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold">Aucune demande</p>
        <p className="text-xs text-muted-foreground">
          Les changements de tarif, grandes remises et dépenses importantes que vous envoyez au directeur
          apparaîtront ici avec sa réponse.
        </p>
      </div>
    );
  }

  return (
    <div className="relative mt-1 max-h-[400px] space-y-0.5 overflow-y-auto p-3">
      {requests.map((request) => {
        const described = describeApproval(request.type, request.summary, formatMoney);
        const Icon = described.icon;
        return (
          <div key={request.id} className="flex items-start gap-3 rounded-[14px] px-2 py-2.5">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-muted text-muted-foreground ring-1 ring-border">
              <Icon className="h-[17px] w-[17px]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[13.5px] font-medium leading-snug">
                {described.title}
                {unseenIds.has(request.id) && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Nouveau" />
                )}
              </p>
              {described.detail && <p className="mt-0.5 text-xs text-muted-foreground">{described.detail}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                <span className={cn('rounded-full px-2 py-0.5 font-semibold', STATUS_STYLE[request.status])}>
                  {APPROVAL_STATUS_LABELS[request.status]}
                </span>
                <span className="text-muted-foreground">{ago(request.decidedAt ?? request.createdAt)}</span>
                {request.status === 'PENDING' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground"
                    disabled={withdraw.isPending}
                    onClick={() => handleWithdraw(request.id)}
                  >
                    Retirer
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
