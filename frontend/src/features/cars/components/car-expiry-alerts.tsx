import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Car } from '../api/cars.api';
import { formatAlertMessage, getCarExpiryAlerts, getWorstAlertLevel } from '../lib/car-alerts';

// Compact indicator for the table/grid: a single badge summarizing the worst
// pending document (insurance/inspection/registration), with the full
// breakdown available on hover so the row stays uncluttered.
export function CarExpiryAlerts({ car }: { car: Car }) {
  const alerts = getCarExpiryAlerts(car);
  const worst = getWorstAlertLevel(alerts);

  if (!worst) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={worst === 'expired' ? 'destructive' : 'warning'} className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          {alerts.length > 1 ? `${alerts.length} documents` : alerts[0]!.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <ul className="space-y-0.5">
          {alerts.map((alert) => (
            <li key={alert.field}>{formatAlertMessage(alert)}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
