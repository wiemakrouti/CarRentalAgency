import { Badge } from '@/components/ui/badge';

import type { TeamMember } from '../api/team.api';
import { memberState } from '../lib/member-state';

export function StatusBadge({ member }: { member: TeamMember }) {
  const state = memberState(member);
  if (state === 'off') return <Badge variant="destructive">Désactivé</Badge>;
  if (state === 'pending') return <Badge variant="warning">Mot de passe à choisir</Badge>;
  return <Badge variant="success">Actif</Badge>;
}
