import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Car } from '../api/cars.api';
import { formatDocumentStatus, getDocumentStatuses, type DocumentLevel } from '../lib/car-alerts';

// Worst first — expired/expiring surface before "up to date", with a
// missing date last of all (nothing to act on urgently, just a gap to fill
// in eventually).
const LEVEL_PRIORITY: Record<DocumentLevel, number> = { expired: 0, expiring: 1, ok: 2, not_set: 3 };

const BADGE_VARIANT: Record<DocumentLevel, 'destructive' | 'warning' | 'success' | 'outline'> = {
  expired: 'destructive',
  expiring: 'warning',
  ok: 'success',
  not_set: 'outline',
};

const LEVEL_ICON = {
  expired: AlertTriangle,
  expiring: AlertTriangle,
  ok: CheckCircle2,
  not_set: HelpCircle,
} as const;

// Compact indicator for the table/grid: one badge per document
// (insurance/inspection/registration) — expired/expiring in
// destructive/warning, up to date in success, and a never-entered date in a
// neutral outline badge, so an empty cell never has to stand in for any of
// these — there's always a badge to say which case it is.
export function CarExpiryAlerts({ car }: { car: Car }) {
  const documents = getDocumentStatuses(car).sort(
    (a, b) => LEVEL_PRIORITY[a.level] - LEVEL_PRIORITY[b.level] || (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0),
  );

  return (
    <div className="flex flex-col items-start gap-1">
      {documents.map((doc) => {
        const Icon = LEVEL_ICON[doc.level];
        return (
          <Tooltip key={doc.field}>
            <TooltipTrigger asChild>
              <Badge variant={BADGE_VARIANT[doc.level]} className="gap-1">
                <Icon className="h-3 w-3" />
                {doc.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{formatDocumentStatus(doc)}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
