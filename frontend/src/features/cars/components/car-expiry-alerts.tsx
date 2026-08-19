import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Car } from '../api/cars.api';
import { formatAlertMessage, getCarExpiryAlerts } from '../lib/car-alerts';

// Compact indicator for the table/grid: one badge per pending document
// (insurance/inspection/registration), stacked, each colored by its own
// level — not merged into a single alert — with exact expiry wording
// available on hover.
export function CarExpiryAlerts({ car }: { car: Car }) {
  const alerts = getCarExpiryAlerts(car);

  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-col items-start gap-1">
      {alerts.map((alert) => (
        <Tooltip key={alert.field}>
          <TooltipTrigger asChild>
            <Badge variant={alert.level === 'expired' ? 'destructive' : 'warning'} className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {alert.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{formatAlertMessage(alert)}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
