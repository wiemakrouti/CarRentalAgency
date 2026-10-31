import { KeyRound, MoreHorizontal, Pencil, Power } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { TeamMember } from '../api/team.api';

type TeamMemberActionsProps = {
  member: TeamMember;
  onEdit: (member: TeamMember) => void;
  onResetPassword: (member: TeamMember) => void;
  onDeactivate: (member: TeamMember) => void;
  onReactivate: (member: TeamMember) => void;
  className?: string;
};

// An employee's "..." menu — shared by the desktop list and the phone cards.
export function TeamMemberActions({
  member,
  onEdit,
  onResetPassword,
  onDeactivate,
  onReactivate,
  className,
}: TeamMemberActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions pour ${member.fullName}`}
          className={cn('shrink-0', className)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(member)}>
          <Pencil className="h-4 w-4" />
          Modifier
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onResetPassword(member)}>
          <KeyRound className="h-4 w-4" />
          Réinitialiser le mot de passe
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {member.deactivatedAt ? (
          <DropdownMenuItem onSelect={() => onReactivate(member)}>
            <Power className="h-4 w-4" />
            Réactiver
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="text-destructive" onSelect={() => onDeactivate(member)}>
            <Power className="h-4 w-4" />
            Désactiver
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
