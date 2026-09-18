import {
  AlertTriangle,
  Award,
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  FilesIcon,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFormatMoney } from '@/hooks/use-format-money';

import type { Client } from '../api/clients.api';
import { useClientQuery, useClientStatsQuery } from '../hooks/use-clients';
import { CLIENT_DOCUMENT_TYPE_LABELS } from '../lib/client-labels';
import {
  formatLicenseAlertMessage,
  getLicenseAlertLevel,
  LICENSE_STATUS_LABELS,
} from '../lib/client-alerts';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-TN');
}

const LICENSE_BADGE_VARIANT = {
  expired: 'destructive',
  expiring: 'warning',
  ok: 'success',
  not_set: 'outline',
} as const;

// Loyalty reads on completed rentals specifically — not the raw total —
// since a pile of RESERVED or CANCELLED rentals isn't actual business done
// with this client, unlike Fiabilité above it can't be null either: a
// brand-new client with zero history is still meaningfully "Nouveau", not
// an unknown value.
type LoyaltyTier = 'new' | 'occasional' | 'regular' | 'vip';

function getLoyaltyTier(completedRentals: number): LoyaltyTier {
  if (completedRentals >= 10) return 'vip';
  if (completedRentals >= 5) return 'regular';
  if (completedRentals >= 1) return 'occasional';
  return 'new';
}

const LOYALTY_LABELS: Record<LoyaltyTier, string> = {
  new: 'Nouveau',
  occasional: 'Occasionnel',
  regular: 'Régulier',
  vip: 'VIP',
};

const LOYALTY_BADGE_VARIANT: Record<LoyaltyTier, 'outline' | 'default' | 'success' | 'warning'> = {
  new: 'outline',
  occasional: 'default',
  regular: 'success',
  vip: 'warning',
};

type ClientProfileSheetProps = {
  clientId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Both take the sheet's own freshly-loaded `client` rather than the
  // caller re-deriving it from a paginated/filtered list — a client opened
  // via a notification deep link (ClientsPage's openId) may not be on the
  // currently loaded page at all, so looking it up there would silently
  // no-op. focusField lets the license badge's "Renouveler" action land
  // directly on that field instead of a form to hunt through.
  onEdit: (client: Client, focusField?: 'drivingLicenseExpiry') => void;
  onManageDocuments: () => void;
  onOpenCalendar: (client: Client) => void;
};

// Deliberately not a flat field list like the Cars module's detail sheet —
// a gradient hero, KPI cards, and a rental-history timeline instead of a
// <dl>, so a client reads as a profile rather than a record dump.
export function ClientProfileSheet({
  clientId,
  open,
  onOpenChange,
  onEdit,
  onManageDocuments,
  onOpenCalendar,
}: ClientProfileSheetProps) {
  const { data: client, isLoading } = useClientQuery(clientId ?? '');
  const { data: stats } = useClientStatsQuery(clientId);
  const formatMoney = useFormatMoney();
  const formatAmount = (value: string | number) => formatMoney(Number(value));

  const licenseAlert = client ? getLicenseAlertLevel(client) : null;
  const initials = client ? `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`.toUpperCase() : '';
  const onTimePct =
    stats?.onTimeReturnRate !== null && stats?.onTimeReturnRate !== undefined
      ? `${Math.round(stats.onTimeReturnRate * 100)}%`
      : '—';
  const reliabilityPct =
    stats?.reliabilityRate !== null && stats?.reliabilityRate !== undefined
      ? `${Math.round(stats.reliabilityRate * 100)}%`
      : '—';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {isLoading || !client ? (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="relative -mx-6 -mt-6 w-[calc(100%+3rem)] overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 px-6 pb-6 pt-7 text-primary-foreground">
              {/* pr-10: the sheet's own close button is absolutely positioned
                  (right-4 top-4, see SheetContent) and overlaps the last
                  ~24px of this row — without this gap, "Modifier" sits
                  underneath it and clicks land on Close instead. */}
              <div className="flex items-start justify-between gap-4 pr-10">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold ring-1 ring-white/25">
                    {initials}
                  </div>
                  <SheetHeader className="items-start gap-0.5 text-left">
                    <SheetTitle className="text-xl text-primary-foreground">
                      {client.firstName} {client.lastName}
                    </SheetTitle>
                    <SheetDescription className="text-primary-100">
                      {client.phone}
                      {client.email ? ` · ${client.email}` : ''}
                    </SheetDescription>
                  </SheetHeader>
                </div>
                <Button size="sm" variant="secondary" onClick={() => onEdit(client)}>
                  Modifier
                </Button>
              </div>

              {licenseAlert && licenseAlert.level !== 'ok' && (
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant={LICENSE_BADGE_VARIANT[licenseAlert.level]} className="gap-1 border-transparent">
                        <AlertTriangle className="h-3 w-3" />
                        {LICENSE_STATUS_LABELS[licenseAlert.level]}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      {formatLicenseAlertMessage(licenseAlert.daysRemaining, licenseAlert.level)}
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-2 text-xs text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
                    onClick={() => onEdit(client, 'drivingLicenseExpiry')}
                  >
                    <RefreshCw className="h-3 w-3" />
                    {licenseAlert.level === 'not_set' ? 'Renseigner' : 'Renouveler'}
                  </Button>
                </div>
              )}
            </div>

            {/* Stat cards */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  Revenu généré
                </div>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {stats ? formatAmount(stats.totalRevenue) : <Skeleton className="h-5 w-16" />}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <FilesIcon className="h-3.5 w-3.5" />
                  Locations totales
                </div>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {stats ? stats.totalRentals : <Skeleton className="h-5 w-10" />}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Client depuis
                </div>
                <p className="mt-1 text-lg font-bold text-foreground">{formatDate(client.createdAt)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Award className="h-3.5 w-3.5" />
                  Statut fidélité
                </div>
                <div className="mt-1.5">
                  {stats ? (
                    <Badge variant={LOYALTY_BADGE_VARIANT[getLoyaltyTier(stats.completedRentals)]}>
                      {LOYALTY_LABELS[getLoyaltyTier(stats.completedRentals)]}
                    </Badge>
                  ) : (
                    <Skeleton className="h-5 w-16" />
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Fiabilité
                </div>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {stats ? reliabilityPct : <Skeleton className="h-5 w-10" />}
                </p>
                {stats && stats.cancelledRentals > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {stats.cancelledRentals} annulée{stats.cancelledRentals > 1 ? 's' : ''} sur{' '}
                    {stats.completedRentals + stats.cancelledRentals}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Ponctualité
                </div>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {stats ? onTimePct : <Skeleton className="h-5 w-10" />}
                </p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Informations personnelles
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Adresse', client.address ?? '—', 'col-span-2'],
                    ['Nationalité', client.nationality ?? '—'],
                    ['N° CIN', client.nationalIdNumber ?? '—'],
                    ['N° Permis', client.drivingLicenseNumber],
                    [
                      'Expiration permis',
                      client.drivingLicenseExpiry ? formatDate(client.drivingLicenseExpiry) : '—',
                    ],
                    [
                      'Date de naissance',
                      client.dateOfBirth ? formatDate(client.dateOfBirth) : '—',
                      'col-span-2',
                    ],
                  ].map(([label, value, span]) => (
                    <div key={label} className={`rounded-xl bg-muted p-3 ${span ?? ''}`}>
                      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                      <p className="text-sm font-semibold text-foreground">{value}</p>
                    </div>
                  ))}
                  {client.notes && (
                    <div className="col-span-2 rounded-xl bg-muted p-3">
                      <p className="text-[11px] font-medium text-muted-foreground">Notes</p>
                      <p className="text-sm text-foreground">{client.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Documents
                  </p>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onManageDocuments}>
                    Gérer
                  </Button>
                </div>
                {client.documents.length > 0 ? (
                  <ul className="space-y-2">
                    {client.documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border p-2.5 text-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={doc.url}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-md border border-border object-cover"
                          />
                          <div>
                            <p className="font-medium">{CLIENT_DOCUMENT_TYPE_LABELS[doc.type]}</p>
                            <p className="text-xs text-muted-foreground">Ajouté le {formatDate(doc.createdAt)}</p>
                          </div>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Ouvrir
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun document pour ce client.</p>
                )}
              </div>
            </div>

            <Separator className="my-4" />

            <Button variant="outline" className="w-full justify-between" onClick={() => onOpenCalendar(client)}>
              <span className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Calendrier et historique des locations
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
