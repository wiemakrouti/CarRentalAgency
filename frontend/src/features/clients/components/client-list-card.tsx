import { IdCard } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { Client } from '../api/clients.api';
import { getLicenseAlertLevel } from '../lib/client-alerts';
import { ClientReliabilityBadge } from './client-reliability-badge';
import { ClientRowActions } from './client-row-actions';

type ClientListCardProps = {
  client: Client;
  onEdit: (client: Client) => void;
  onViewProfile: (client: Client) => void;
  onOpenCalendar: (client: Client) => void;
};

// The Clients table's row as a card, for phones — who the client is and how
// to reach them on top, their license and actions underneath, the same
// shape as the Rentals and Cars cards. Tapping the card opens the profile.
export function ClientListCard({ client, onEdit, onViewProfile, onOpenCalendar }: ClientListCardProps) {
  const { firstName, lastName } = client;
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const license = getLicenseAlertLevel(client);
  // A valid license is the normal case — only a problem earns room here.
  const licenseAlert = license.level === 'expired' || license.level === 'expiring';

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      {/* Stretched button over the body rather than a wrapping <button>: the
          reliability badge is a tooltip trigger, kept above the overlay. */}
      <div className="relative flex items-center gap-3 p-4 pb-3 transition-colors has-[>div>button:active]:bg-muted/40">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700 dark:bg-primary/15 dark:text-primary">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onViewProfile(client)}
            className="block w-full truncate text-left text-sm font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
          >
            {firstName} {lastName}
          </button>
          <p className="truncate text-xs text-muted-foreground">
            {client.phone}
            {client.city && ` · ${client.city}`}
          </p>
        </div>
        <div className="relative z-10 shrink-0">
          <ClientReliabilityBadge client={client} />
        </div>
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border/60 pl-4 pr-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <IdCard className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-mono">{client.drivingLicenseNumber}</span>
          </span>
          {licenseAlert && (
            <Badge
              variant={license.level === 'expired' ? 'destructive' : 'warning'}
              className="shrink-0"
            >
              {/* Short — it sits right after the license number. */}
              {license.level === 'expired' ? 'Expiré' : `Expire dans ${license.daysRemaining} j`}
            </Badge>
          )}
        </div>
        <ClientRowActions
          client={client}
          onEdit={onEdit}
          onViewProfile={onViewProfile}
          onOpenCalendar={onOpenCalendar}
        />
      </div>
    </article>
  );
}
