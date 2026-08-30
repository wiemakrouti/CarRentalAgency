import { AlertTriangle, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Client } from '../api/clients.api';
import { formatReliabilityMessage, getReliabilityLevel, RELIABILITY_LABELS } from '../lib/client-alerts';

const BADGE_VARIANT = {
  high: 'success',
  medium: 'warning',
  low: 'destructive',
  new: 'outline',
} as const;

const BADGE_ICON = {
  high: ShieldCheck,
  medium: AlertTriangle,
  low: ShieldAlert,
  new: ShieldQuestion,
} as const;

// Compact indicator for the clients table — mirrors ClientLicenseBadge, but
// for reliabilityRate (share of resolved rentals actually honored) instead
// of the driving license expiry.
export function ClientReliabilityBadge({
  client,
}: {
  client: Pick<Client, 'reliabilityRate' | 'completedRentals' | 'cancelledRentals'>;
}) {
  const level = getReliabilityLevel(client.reliabilityRate);
  const Icon = BADGE_ICON[level];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={BADGE_VARIANT[level]} className="gap-1">
          <Icon className="h-3 w-3" />
          {RELIABILITY_LABELS[level]}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {formatReliabilityMessage(client.completedRentals, client.cancelledRentals, level)}
      </TooltipContent>
    </Tooltip>
  );
}
