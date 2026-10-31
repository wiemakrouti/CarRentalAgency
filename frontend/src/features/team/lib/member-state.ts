import type { TeamMember } from '../api/team.api';

export type MemberState = 'active' | 'pending' | 'off';

// Pending: still on the temporary password the director gave them.
export function memberState(member: TeamMember): MemberState {
  if (member.deactivatedAt) return 'off';
  if (member.mustChangePassword) return 'pending';
  return 'active';
}
