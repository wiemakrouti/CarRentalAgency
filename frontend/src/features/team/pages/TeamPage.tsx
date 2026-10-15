import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, MoreHorizontal, Pencil, Power, UserPlus, Users } from 'lucide-react';

import { ApiClientError } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { PageHero } from '@/components/common/page-hero';

import type { TeamMember } from '../api/team.api';
import { ResetPasswordDialog } from '../components/reset-password-dialog';
import { TeamMemberDialog } from '../components/team-member-dialog';
import { useSetEmployeeActiveMutation, useTeamQuery } from '../hooks/use-team';

function lastLogin(member: TeamMember): string {
  if (!member.lastLoginAt) return 'Jamais connecté';
  return `Dernière connexion le ${new Date(member.lastLoginAt).toLocaleString('fr-TN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })}`;
}

function StatusBadge({ member }: { member: TeamMember }) {
  if (member.deactivatedAt) return <Badge variant="destructive">Désactivé</Badge>;
  if (member.mustChangePassword) return <Badge variant="warning">Mot de passe à choisir</Badge>;
  return <Badge variant="success">Actif</Badge>;
}

// The director's team: who can sign in to the agency, with what role, and
// the levers to control it — add an employee, edit, reset a forgotten
// password, or cut someone off at once.
export function TeamPage() {
  const { data, isLoading, isError, refetch } = useTeamQuery();
  const setActive = useSetEmployeeActiveMutation();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [resetting, setResetting] = useState<TeamMember | null>(null);
  const [deactivating, setDeactivating] = useState<TeamMember | null>(null);

  const employees = data?.filter((m) => m.role === 'EMPLOYEE') ?? [];

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  async function changeActive(member: TeamMember, active: boolean) {
    try {
      await setActive.mutateAsync({ id: member.id, active });
      toast.success(active ? `${member.fullName} peut de nouveau se connecter.` : `${member.fullName} a été désactivé.`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Une erreur est survenue.');
    }
  }

  return (
    <PageContainer>
      <PageHero>
        <PageHeader
          title="Équipe"
          description="Gérez les comptes et les accès de votre équipe."
          actions={
            <Button onClick={openCreate}>
              <UserPlus className="h-4 w-4" />
              Ajouter un employé
            </Button>
          }
        />
      </PageHero>

      {isLoading && <LoadingState message="Chargement de l'équipe..." />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {data.map((member) => {
              const isEmployee = member.role === 'EMPLOYEE';
              return (
                <div key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                  <span
                    className={
                      member.deactivatedAt
                        ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground'
                        : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-700 text-sm font-bold text-primary-foreground'
                    }
                  >
                    {member.fullName.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span className="truncate">{member.fullName}</span>
                      <Badge variant={isEmployee ? 'secondary' : 'default'}>{isEmployee ? 'Employé' : 'Directeur'}</Badge>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email} · {lastLogin(member)}
                    </p>
                  </div>
                  <StatusBadge member={member} />
                  {isEmployee ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions pour ${member.fullName}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(member);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setResetting(member)}>
                          <KeyRound className="h-4 w-4" />
                          Réinitialiser le mot de passe
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {member.deactivatedAt ? (
                          <DropdownMenuItem onSelect={() => changeActive(member, true)}>
                            <Power className="h-4 w-4" />
                            Réactiver
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className="text-destructive" onSelect={() => setDeactivating(member)}>
                            <Power className="h-4 w-4" />
                            Désactiver
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="w-9" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {data && employees.length === 0 && (
        <EmptyState
          icon={Users}
          title="Aucun employé pour l'instant"
          description="Créez un compte pour chaque employé : vous verrez ce que chacun fait dans l'application."
          action={<Button onClick={openCreate}>Ajouter un employé</Button>}
        />
      )}

      <TeamMemberDialog open={formOpen} onOpenChange={setFormOpen} member={editing} />
      <ResetPasswordDialog member={resetting} onOpenChange={(open) => !open && setResetting(null)} />
      <ConfirmDialog
        open={Boolean(deactivating)}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title={`Désactiver ${deactivating?.fullName ?? ''} ?`}
        description="Il sera déconnecté immédiatement et ne pourra plus se connecter. Son historique est conservé, et vous pourrez le réactiver à tout moment."
        confirmLabel="Désactiver"
        variant="destructive"
        onConfirm={async () => {
          if (deactivating) await changeActive(deactivating, false);
          setDeactivating(null);
        }}
      />
    </PageContainer>
  );
}
