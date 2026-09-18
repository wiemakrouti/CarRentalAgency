import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, LogOut, Monitor, Smartphone, Wallet } from 'lucide-react';
import { CURRENCY_OPTIONS, updateSettingsSchema } from '@car-rental/shared';
import type { z } from 'zod';

import { useSettings } from '@/providers/settings-provider';
import { ApiClientError } from '@/lib/api-client';
import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { PageHero } from '@/components/common/page-hero';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { isMobileUserAgent, parseUserAgent } from '@/features/profile/lib/parse-user-agent';
import {
  useRevokeOtherSessionsMutation,
  useRevokeSessionMutation,
  useSessionsQuery,
} from '@/features/profile/hooks/use-profile';

import type { Settings } from '../api/settings.api';
import { toSettingsFormValues } from '../lib/settings-form';
import { useUpdateSettingsMutation } from '../hooks/use-settings';

// The agency identity fields (name, logo, address, phone, contact email,
// tax id) moved to the Profil page — this form only ever edits the
// operational settings below, then merges over the rest of the current
// settings (see onSubmit) so identity stays exactly as last saved there.
const operationalSettingsSchema = updateSettingsSchema.omit({
  agencyName: true,
  foundedAt: true,
  address: true,
  phone: true,
  email: true,
  logoUrl: true,
  taxId: true,
  iban: true,
});
type OperationalSettingsInput = z.infer<typeof operationalSettingsSchema>;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

function toFormValues(settings: Settings): OperationalSettingsInput {
  const full = toSettingsFormValues(settings);
  return {
    currencyCode: full.currencyCode,
    defaultDepositAmount: full.defaultDepositAmount,
    reminderWindowDays: full.reminderWindowDays,
  };
}

// Login time is all a session carries (there's no last-activity tracking),
// so this reads "Connecté il y a X" rather than implying recent activity.
function formatRelativeTime(value: string): string {
  const diffMinutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (diffMinutes < 1) return "à l'instant";
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `il y a ${diffDays} j`;
}

export function SettingsPage() {
  const { settings, isLoading, setSettings, refetch } = useSettings();
  const updateMutation = useUpdateSettingsMutation();

  const sessionsQuery = useSessionsQuery();
  const revokeSessionMutation = useRevokeSessionMutation();
  const revokeOtherSessionsMutation = useRevokeOtherSessionsMutation();
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);
  const [revokeOthersOpen, setRevokeOthersOpen] = useState(false);
  const otherSessionsCount = sessionsQuery.data?.filter((s) => !s.isCurrent).length ?? 0;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<OperationalSettingsInput>({
    resolver: zodResolver(operationalSettingsSchema),
    defaultValues: settings ? toFormValues(settings) : undefined,
  });

  // Explicit reset()-in-effect, not useForm's `values` option: under
  // StrictMode's double-invoked effects, `values` intermittently leaves
  // Controller-driven fields (currencyCode — anything not backed by a plain
  // register() DOM input) at their empty initial value even though `settings` itself
  // is correct — a known react-hook-form/StrictMode interaction. A guard
  // keyed on `updatedAt` makes this idempotent across StrictMode's
  // synthetic double-invoke: without it, the *second* invocation (same
  // `settings`, same render) was observed to reset those same fields right
  // back to empty immediately after the first invocation had correctly set
  // them — so it isn't enough that `reset()` itself is safe to call twice,
  // the second call has to genuinely not happen at all.
  const resetForUpdatedAt = useRef<string | null>(null);
  useEffect(() => {
    if (settings && resetForUpdatedAt.current !== settings.updatedAt) {
      resetForUpdatedAt.current = settings.updatedAt;
      reset(toFormValues(settings));
    }
  }, [settings, reset]);

  async function onSubmit(values: OperationalSettingsInput) {
    if (!settings) return;
    try {
      // Identity fields (name, logo, address, phone, email) are edited on
      // Profil, not here — carry the currently-loaded ones through
      // unchanged rather than submitting this form's own (nonexistent) copy.
      const updated = await updateMutation.mutateAsync({
        ...toSettingsFormValues(settings),
        ...values,
      });
      setSettings(updated);
      toast.success('Paramètres enregistrés.');
    } catch (err) {
      toast.error(errorMessage(err, "Erreur lors de l'enregistrement des paramètres."));
    }
  }

  return (
    <PageContainer>
      <PageHero>
        <PageHeader
          title="Paramètres"
          description="Configurez la devise et les rappels de l'application."
        />
      </PageHero>

      {isLoading && <LoadingState message="Chargement des paramètres..." />}
      {!isLoading && !settings && (
        <ErrorState
          description="Impossible de charger les paramètres de l'agence."
          onRetry={refetch}
        />
      )}

      {settings && (
        <>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <Card className="min-w-0">
              <CardHeader className="flex flex-row items-center gap-3.5 space-y-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 text-primary-foreground shadow-[0_4px_10px_-4px_hsl(var(--primary-500)/0.5)]">
                  <Wallet className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <CardTitle className="text-base">Devise &amp; location</CardTitle>
                  <CardDescription>
                    S'applique à tous les montants affichés dans l'application.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="currencyCode" required>
                      Devise
                    </Label>
                    <Controller
                      control={control}
                      name="currencyCode"
                      // Controller's own `field.value` is undefined on its very
                      // first internal render — before its registration effect
                      // wires up useForm's `defaultValues` — regardless of what
                      // defaultValues/reset() already hold. Radix's Select reads
                      // that first undefined, treats itself as uncontrolled (see
                      // the "changing from uncontrolled to controlled" warning),
                      // and its trigger never picks up the real value afterwards.
                      // An explicit `defaultValue` here is what Controller
                      // actually reads on that first render.
                      defaultValue={settings.currencyCode}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="currencyCode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CURRENCY_OPTIONS.map((option) => (
                              <SelectItem key={option.code} value={option.code}>
                                {option.label} ({option.symbol})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultDepositAmount" required>
                      Caution par défaut
                    </Label>
                    <Input
                      id="defaultDepositAmount"
                      type="number"
                      step="0.001"
                      min="0"
                      {...register('defaultDepositAmount', { setValueAs: Number })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Pré-remplit la caution d'une nouvelle location quand aucun montant n'est
                      saisi.
                    </p>
                    {errors.defaultDepositAmount && (
                      <p className="text-sm text-destructive">
                        {errors.defaultDepositAmount.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reminderWindowDays" required>
                      Fenêtre des rappels (jours)
                    </Label>
                    <Input
                      id="reminderWindowDays"
                      type="number"
                      step="1"
                      min="1"
                      max="90"
                      {...register('reminderWindowDays', { setValueAs: Number })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Les échéances (assurances, permis, contrôles techniques...) apparaissent dans
                      la cloche de notifications ce nombre de jours à l'avance.
                    </p>
                    {errors.reminderWindowDays && (
                      <p className="text-sm text-destructive">
                        {errors.reminderWindowDays.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button type="submit" disabled={updateMutation.isPending || !isDirty}>
                    {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Enregistrer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-[0_4px_10px_-4px_rgba(51,102,232,0.5)]">
                  <Monitor className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <CardTitle className="text-base">Sessions actives</CardTitle>
                  <CardDescription>
                    Les appareils actuellement connectés à votre compte.
                  </CardDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={otherSessionsCount === 0 || revokeOtherSessionsMutation.isPending}
                onClick={() => setRevokeOthersOpen(true)}
              >
                <LogOut className="h-4 w-4" />
                Déconnecter les autres appareils
              </Button>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Timeline connector running behind the icon column — visible
                  only in the gaps between rows, since each row's own
                  background covers it everywhere else. */}
                {(sessionsQuery.data?.length ?? 0) > 1 && (
                  <div className="pointer-events-none absolute bottom-5 left-[30px] top-5 w-px bg-primary/15 dark:bg-primary/25" />
                )}
                <div className="space-y-2.5">
                  {sessionsQuery.isLoading && (
                    <>
                      <Skeleton className="h-16 w-full rounded-xl" />
                      <Skeleton className="h-16 w-full rounded-xl" />
                    </>
                  )}
                  {sessionsQuery.isError && (
                    <p className="text-sm text-destructive">
                      Impossible de charger vos sessions actives.
                    </p>
                  )}
                  {sessionsQuery.data?.length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucune session active.</p>
                  )}
                  {sessionsQuery.data?.map((session) => (
                    <div
                      key={session.id}
                      className="relative flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {isMobileUserAgent(session.userAgent) ? (
                          <Smartphone className="h-4 w-4" />
                        ) : (
                          <Monitor className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {parseUserAgent(session.userAgent)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {session.isCurrent ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-success">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                              Actif maintenant
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Connecté {formatRelativeTime(session.createdAt)}
                            </span>
                          )}
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            {session.ipAddress ?? 'IP inconnue'}
                          </span>
                        </div>
                      </div>
                      {!session.isCurrent && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setSessionToRevoke(session.id)}
                        >
                          Déconnecter
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={sessionToRevoke !== null}
        onOpenChange={(open) => !open && setSessionToRevoke(null)}
        title="Déconnecter cet appareil ?"
        description="Cette session sera immédiatement invalidée et l'appareil devra se reconnecter avec le mot de passe."
        confirmLabel="Déconnecter"
        variant="destructive"
        onConfirm={async () => {
          if (!sessionToRevoke) return;
          try {
            await revokeSessionMutation.mutateAsync(sessionToRevoke);
            toast.success('Appareil déconnecté.');
          } catch (err) {
            toast.error(errorMessage(err, "Erreur lors de la déconnexion de l'appareil."));
          }
        }}
      />

      <ConfirmDialog
        open={revokeOthersOpen}
        onOpenChange={setRevokeOthersOpen}
        title="Déconnecter tous les autres appareils ?"
        description="Toutes vos autres sessions actives seront immédiatement invalidées. Cette session-ci restera connectée."
        confirmLabel="Déconnecter les autres appareils"
        variant="destructive"
        onConfirm={async () => {
          try {
            await revokeOtherSessionsMutation.mutateAsync();
            toast.success('Les autres appareils ont été déconnectés.');
          } catch (err) {
            toast.error(errorMessage(err, 'Erreur lors de la déconnexion des autres appareils.'));
          }
        }}
      />
    </PageContainer>
  );
}
