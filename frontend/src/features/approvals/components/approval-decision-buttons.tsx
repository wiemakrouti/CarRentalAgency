import { toast } from 'sonner';
import { Check, Loader2, X } from 'lucide-react';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

import { useApproveMutation, useRejectMutation } from '../hooks/use-approvals';

// The director's two answers to a request. Validating runs the employee's
// action right away (it may still fail — e.g. the car got booked meanwhile —
// in which case the request stays pending and the reason is shown).
export function ApprovalDecisionButtons({ requestId }: { requestId: string }) {
  const approve = useApproveMutation();
  const reject = useRejectMutation();
  const busy = approve.isPending || reject.isPending;

  async function decide(kind: 'approve' | 'reject') {
    try {
      await (kind === 'approve' ? approve : reject).mutateAsync(requestId);
      toast.success(kind === 'approve' ? 'Demande validée.' : 'Demande refusée.');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Impossible de traiter la demande.');
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => decide('reject')}>
        {reject.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        Refuser
      </Button>
      <Button type="button" size="sm" disabled={busy} onClick={() => decide('approve')}>
        {approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Valider
      </Button>
    </div>
  );
}
