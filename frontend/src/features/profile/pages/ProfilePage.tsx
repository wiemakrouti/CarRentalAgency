import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Building2, KeyRound, Loader2, RotateCcw, User } from 'lucide-react';
import {
  changePasswordSchema,
  updateProfileSchema,
  updateSettingsSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from '@car-rental/shared';
import type { z } from 'zod';

import { useAuth } from '@/providers/auth-provider';
import { useSettings } from '@/providers/settings-provider';
import { ApiClientError } from '@/lib/api-client';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Settings } from '@/features/settings/api/settings.api';
import { toSettingsFormValues } from '@/features/settings/lib/settings-form';
import { useUpdateSettingsMutation } from '@/features/settings/hooks/use-settings';

import { AgencyLogoField } from '../components/agency-logo-field';
import { Field, Panel, SectionTitle } from '../components/panel';
import { useChangePasswordMutation, useUpdateProfileMutation } from '../hooks/use-profile';

// Only ADMIN exists today (see @car-rental/shared's ROLES) — a lookup table
// still reads better than a raw enum value and needs no changes if a second
// role is ever introduced.
const ROLE_LABELS: Record<string, string> = { ADMIN: 'Administrateur' };

// This page only edits the agency's identity fields — the rest of Setting
// (currency, contract/fiscal defaults, brand color) lives on Paramètres.
// See settings-form.ts for why onSubmit merges this subset back onto the
// currently-loaded settings instead of submitting it alone. logoUrl is
// deliberately not part of this text form — AgencyLogoField uploads and
// saves it immediately on its own, since a file input can't be registered
// into a react-hook-form text field.
const agencyIdentitySchema = updateSettingsSchema.pick({
  agencyName: true,
  foundedAt: true,
  address: true,
  phone: true,
  email: true,
  taxId: true,
  iban: true,
});
type AgencyIdentityInput = z.infer<typeof agencyIdentitySchema>;

// Fields counted toward the "profile completeness" chip — agencyName is
// included even though it's required, so a brand new agency (which only
// ever set this one field at registration) starts above 0% instead of
// looking like an empty profile.
const IDENTITY_COMPLETION_FIELDS = [
  'agencyName',
  'logoUrl',
  'foundedAt',
  'address',
  'phone',
  'email',
  'taxId',
  'iban',
] as const;

function agencyCompletion(settings: Settings): number {
  const filled = IDENTITY_COMPLETION_FIELDS.filter((key) => Boolean(settings[key])).length;
  return Math.round((filled / IDENTITY_COMPLETION_FIELDS.length) * 100);
}

// Accepts loose input (spaces, dashes, a leading "216" with or without "+")
// and normalizes it to "+216 XX XXX XXX" on blur — see settings.schema.ts's
// phone regex, which this is the sole intended source of valid values for.
function formatTunisianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('216') ? digits.slice(3) : digits;
  if (local.length !== 8) return raw.trim();
  return `+216 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 8)}`;
}

function nullableTextProps() {
  // Every optional text field stores `null`, not `""`, when empty — same
  // convention as SettingsPage. Without it, clearing a field submits an
  // empty string the shared schema's `.nullable()` branch never matches.
  return { setValueAs: (v: string) => (v === '' ? null : v) };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?'
  );
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-TN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function dateToInputValue(date: Date | null | undefined): string {
  if (!date) return '';
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function pickIdentity(settings: Settings): AgencyIdentityInput {
  return {
    agencyName: settings.agencyName,
    foundedAt: settings.foundedAt ? new Date(settings.foundedAt) : null,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    taxId: settings.taxId,
    iban: settings.iban,
  };
}

// Same underline-tab language as Finances' TAB_TRIGGER_CLASSES/TAB_ICON_CLASSES
// (see FinancesPage.tsx) — scoped here via className overrides rather than
// touching ui/tabs.tsx, which other call sites still use as a plain
// segmented control.
const TAB_TRIGGER_CLASSES =
  'group h-auto shrink-0 gap-2.5 rounded-none border-b-2 border-transparent px-1 py-3 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none';

const TAB_ICON_CLASSES =
  'flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-all group-hover:text-foreground ' +
  'group-data-[state=active]:bg-gradient-to-br group-data-[state=active]:from-primary-500 group-data-[state=active]:to-primary-600 group-data-[state=active]:text-primary-foreground ' +
  'group-data-[state=active]:shadow-[0_0_0_4px_hsl(var(--primary-500)/0.16),0_8px_20px_-6px_hsl(var(--primary-500)/0.65)] ' +
  'dark:group-data-[state=active]:from-primary dark:group-data-[state=active]:to-primary dark:group-data-[state=active]:shadow-[0_0_0_4px_hsl(var(--primary)/0.18),0_8px_20px_-6px_hsl(var(--primary)/0.45)]';

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const {
    settings,
    isLoading: settingsLoading,
    setSettings,
    refetch: refetchSettings,
  } = useSettings();
  const updateSettingsMutation = useUpdateSettingsMutation();
  const updateProfileMutation = useUpdateProfileMutation();
  const changePasswordMutation = useChangePasswordMutation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'agency' | 'account'>(
    searchParams.get('tab') === 'account' ? 'account' : 'agency',
  );

  const agencyForm = useForm<AgencyIdentityInput>({
    resolver: zodResolver(agencyIdentitySchema),
    defaultValues: settings ? pickIdentity(settings) : undefined,
  });

  // Same StrictMode-safe reset guard as SettingsPage — see its comment for
  // why a plain `values` option isn't used here instead.
  const resetForUpdatedAt = useRef<string | null>(null);
  useEffect(() => {
    if (settings && resetForUpdatedAt.current !== settings.updatedAt) {
      resetForUpdatedAt.current = settings.updatedAt;
      agencyForm.reset(pickIdentity(settings));
    }
  }, [settings, agencyForm]);

  const profileForm = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    // `values` (not `defaultValues`) keeps the form in sync if `user`
    // changes out from under it — e.g. a successful save updates the
    // AuthProvider user, which should flow back in as the new baseline
    // rather than leaving the form's own copy stale.
    values: user ? { fullName: user.fullName, email: user.email } : undefined,
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  async function onSubmitAgency(values: AgencyIdentityInput) {
    if (!settings) return;
    try {
      const updated = await updateSettingsMutation.mutateAsync({
        ...toSettingsFormValues(settings),
        ...values,
      });
      setSettings(updated);
      toast.success('Profil de l’agence mis à jour.');
    } catch (err) {
      toast.error(errorMessage(err, "Erreur lors de la mise à jour du profil de l'agence."));
    }
  }

  async function onSubmitProfile(values: UpdateProfileInput) {
    try {
      const updated = await updateProfileMutation.mutateAsync(values);
      updateUser(updated);
      toast.success('Compte mis à jour.');
    } catch (err) {
      toast.error(errorMessage(err, 'Erreur lors de la mise à jour du compte.'));
    }
  }

  async function onSubmitPassword(values: ChangePasswordInput) {
    try {
      await changePasswordMutation.mutateAsync(values);
      passwordForm.reset();
      toast.success('Mot de passe modifié. Vos autres appareils ont été déconnectés.');
    } catch (err) {
      toast.error(errorMessage(err, 'Erreur lors du changement de mot de passe.'));
    }
  }

  // Route sits behind ProtectedRoute, so `user` is only ever null for the
  // one render before AuthProvider's session-restore resolves.
  if (!user) return null;

  return (
    <div className="relative flex-1 bg-primary-50 dark:bg-background">
      <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const tab = value as 'agency' | 'account';
            setActiveTab(tab);
            setSearchParams(tab === 'account' ? { tab: 'account' } : {}, { replace: true });
          }}
        >
          <TabsList className="mb-6 h-auto w-full justify-start gap-9 rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="agency" className={TAB_TRIGGER_CLASSES}>
              <span className={TAB_ICON_CLASSES}>
                <Building2 className="h-4 w-4" />
              </span>
              Profil de l'agence
            </TabsTrigger>
            <TabsTrigger value="account" className={TAB_TRIGGER_CLASSES}>
              <span className={TAB_ICON_CLASSES}>
                <User className="h-4 w-4" />
              </span>
              Mon compte
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agency" className="mt-0">
            {settingsLoading && <LoadingState message="Chargement du profil de l'agence..." />}
            {!settingsLoading && !settings && (
              <ErrorState
                description="Impossible de charger le profil de l'agence."
                onRetry={refetchSettings}
              />
            )}

            {settings && (
              <form onSubmit={agencyForm.handleSubmit(onSubmitAgency)}>
                <Panel className="overflow-hidden p-0">
                  <div className="grid lg:grid-cols-[260px_1fr]">
                    {/* Identity sidebar */}
                    <div className="flex flex-col items-center border-b border-border p-8 text-center lg:border-b-0 lg:border-r">
                      <AgencyLogoField
                        settings={settings}
                        onUpdated={setSettings}
                        layout="vertical"
                      />
                      <h1 className="mt-4 text-base font-bold text-foreground">
                        {settings.agencyName}
                      </h1>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[settings.address, settings.phone].filter(Boolean).join(' · ') ||
                          'Aucune coordonnée renseignée'}
                      </p>

                      <div className="mt-6 flex w-full flex-col divide-y divide-border">
                        <div className="flex flex-col gap-0.5 py-3">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Devise
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {settings.currencyCode}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 py-3">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Dernière mise à jour
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {formatDate(settings.updatedAt)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 py-3">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Profil complété
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {agencyCompletion(settings)}%
                          </span>
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${agencyCompletion(settings)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Form */}
                    <div className="p-6 sm:p-8">
                      <SectionTitle>Informations de l'agence</SectionTitle>
                      <p className="text-xs text-muted-foreground">
                        Renseignez les coordonnées et informations de votre agence.
                      </p>
                      <div className="mt-5 space-y-4">
                        <Field label="Nom de l'agence" htmlFor="agencyName">
                          <Input id="agencyName" {...agencyForm.register('agencyName')} />
                          {agencyForm.formState.errors.agencyName && (
                            <p className="mt-1 text-xs text-destructive">
                              {agencyForm.formState.errors.agencyName.message}
                            </p>
                          )}
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Adresse" htmlFor="address">
                            <Input
                              id="address"
                              {...agencyForm.register('address', nullableTextProps())}
                            />
                            {agencyForm.formState.errors.address && (
                              <p className="mt-1 text-xs text-destructive">
                                {agencyForm.formState.errors.address.message}
                              </p>
                            )}
                          </Field>
                          <Field label="Date de création" htmlFor="foundedAt">
                            <Controller
                              name="foundedAt"
                              control={agencyForm.control}
                              render={({ field }) => (
                                <Input
                                  id="foundedAt"
                                  type="date"
                                  max={dateToInputValue(new Date())}
                                  value={dateToInputValue(field.value)}
                                  onChange={(e) =>
                                    field.onChange(
                                      e.target.value === '' ? null : new Date(e.target.value),
                                    )
                                  }
                                />
                              )}
                            />
                            {agencyForm.formState.errors.foundedAt && (
                              <p className="mt-1 text-xs text-destructive">
                                {agencyForm.formState.errors.foundedAt.message}
                              </p>
                            )}
                          </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Téléphone" htmlFor="phone">
                            <Input
                              id="phone"
                              placeholder="+216 20 123 456"
                              {...agencyForm.register('phone', {
                                ...nullableTextProps(),
                                onBlur: (e: FocusEvent<HTMLInputElement>) => {
                                  if (!e.target.value) return;
                                  agencyForm.setValue(
                                    'phone',
                                    formatTunisianPhone(e.target.value),
                                    {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    },
                                  );
                                },
                              })}
                            />
                            {agencyForm.formState.errors.phone && (
                              <p className="mt-1 text-xs text-destructive">
                                {agencyForm.formState.errors.phone.message}
                              </p>
                            )}
                          </Field>
                          <Field label="Email" htmlFor="agencyEmail">
                            <Input
                              id="agencyEmail"
                              type="email"
                              {...agencyForm.register('email', nullableTextProps())}
                            />
                            {agencyForm.formState.errors.email && (
                              <p className="mt-1 text-xs text-destructive">
                                {agencyForm.formState.errors.email.message}
                              </p>
                            )}
                          </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Matricule fiscal" htmlFor="taxId">
                            <Input
                              id="taxId"
                              {...agencyForm.register('taxId', nullableTextProps())}
                            />
                            {agencyForm.formState.errors.taxId && (
                              <p className="mt-1 text-xs text-destructive">
                                {agencyForm.formState.errors.taxId.message}
                              </p>
                            )}
                          </Field>
                          <Field label="IBAN" htmlFor="iban">
                            <Input
                              id="iban"
                              placeholder="TN59 XXXX XXXX XXXX XXXX XXXX"
                              {...agencyForm.register('iban', nullableTextProps())}
                            />
                            {agencyForm.formState.errors.iban && (
                              <p className="mt-1 text-xs text-destructive">
                                {agencyForm.formState.errors.iban.message}
                              </p>
                            )}
                          </Field>
                        </div>
                      </div>
                      <div className="mt-6 flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={
                            updateSettingsMutation.isPending || !agencyForm.formState.isDirty
                          }
                          onClick={() => agencyForm.reset(pickIdentity(settings))}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Réinitialiser
                        </Button>
                        <Button
                          type="submit"
                          disabled={
                            updateSettingsMutation.isPending || !agencyForm.formState.isDirty
                          }
                        >
                          {updateSettingsMutation.isPending && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  </div>
                </Panel>
              </form>
            )}
          </TabsContent>

          <TabsContent value="account" className="mt-0">
            <Panel className="mb-6 p-6 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-primary-400 to-primary-700 text-lg font-semibold text-primary-foreground">
                      {initials(user.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-foreground">{user.fullName}</h2>
                      <Badge>{ROLE_LABELS[user.role] ?? user.role}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="rounded-xl border border-border bg-card/60 px-4 py-2.5 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Membre depuis
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatDate(user.createdAt)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card/60 px-4 py-2.5 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Dernière connexion
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatDate(user.lastLoginAt)}
                    </p>
                  </div>
                </div>
              </div>
            </Panel>

            <div className="grid gap-6 lg:grid-cols-2">
              <form onSubmit={profileForm.handleSubmit(onSubmitProfile)}>
                <Panel className="h-full p-6 sm:p-7">
                  <SectionTitle>Informations de connexion</SectionTitle>
                  <p className="text-xs text-muted-foreground">
                    Votre nom et votre adresse email de connexion.
                  </p>
                  <div className="mt-5 space-y-4">
                    <Field label="Nom complet" htmlFor="fullName">
                      <Input id="fullName" {...profileForm.register('fullName')} />
                      {profileForm.formState.errors.fullName && (
                        <p className="mt-1 text-xs text-destructive">
                          {profileForm.formState.errors.fullName.message}
                        </p>
                      )}
                    </Field>
                    <Field label="Email" htmlFor="email">
                      <Input id="email" type="email" {...profileForm.register('email')} />
                      {profileForm.formState.errors.email && (
                        <p className="mt-1 text-xs text-destructive">
                          {profileForm.formState.errors.email.message}
                        </p>
                      )}
                    </Field>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button
                      type="submit"
                      disabled={updateProfileMutation.isPending || !profileForm.formState.isDirty}
                    >
                      {updateProfileMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Enregistrer
                    </Button>
                  </div>
                </Panel>
              </form>

              <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)}>
                <Panel className="h-full p-6 sm:p-7">
                  <SectionTitle>Changer le mot de passe</SectionTitle>
                  <p className="text-xs text-muted-foreground">
                    Vous serez déconnecté de vos autres appareils après ce changement.
                  </p>
                  <div className="mt-5 space-y-4">
                    <Field label="Mot de passe actuel" htmlFor="currentPassword">
                      <PasswordInput
                        id="currentPassword"
                        autoComplete="current-password"
                        {...passwordForm.register('currentPassword')}
                      />
                      {passwordForm.formState.errors.currentPassword && (
                        <p className="mt-1 text-xs text-destructive">
                          {passwordForm.formState.errors.currentPassword.message}
                        </p>
                      )}
                    </Field>
                    <Field label="Nouveau mot de passe" htmlFor="newPassword">
                      <PasswordInput
                        id="newPassword"
                        autoComplete="new-password"
                        {...passwordForm.register('newPassword')}
                      />
                      {passwordForm.formState.errors.newPassword && (
                        <p className="mt-1 text-xs text-destructive">
                          {passwordForm.formState.errors.newPassword.message}
                        </p>
                      )}
                    </Field>
                    <Field label="Confirmer le mot de passe" htmlFor="confirmPassword">
                      <PasswordInput
                        id="confirmPassword"
                        autoComplete="new-password"
                        {...passwordForm.register('confirmPassword')}
                      />
                      {passwordForm.formState.errors.confirmPassword && (
                        <p className="mt-1 text-xs text-destructive">
                          {passwordForm.formState.errors.confirmPassword.message}
                        </p>
                      )}
                    </Field>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={changePasswordMutation.isPending}
                    >
                      {changePasswordMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      Modifier le mot de passe
                    </Button>
                  </div>
                </Panel>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
