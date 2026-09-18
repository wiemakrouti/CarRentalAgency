import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Car } from '../api/cars.api';
import { formatDocumentStatus, getDocumentStatuses, summarizeDocumentStatuses, type DocumentLevel } from '../lib/car-alerts';

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

// Compact indicator for the table/grid: a single badge summarizing the
// worst of the car's three documents (insurance/inspection/registration) —
// the per-document breakdown (label + exact date/status) lives in the
// tooltip instead of three separate badges stacked in the cell. Keeps every
// row the same height regardless of how many documents are set, and reads
// at a glance instead of three labels to parse; the full detail with
// renew/fill-in actions is still one click away in the car's detail sheet.
export function CarExpiryAlerts({ car }: { car: Car }) {
  const documents = getDocumentStatuses(car);
  const summary = summarizeDocumentStatuses(documents);
  const Icon = LEVEL_ICON[summary.level];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={BADGE_VARIANT[summary.level]} className="gap-1">
          <Icon className="h-3 w-3" />
          {summary.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-0.5">
          {documents.map((doc) => (
            <span key={doc.field}>
              {doc.label} — {formatDocumentStatus(doc)}
            </span>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
