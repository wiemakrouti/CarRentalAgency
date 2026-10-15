import type { Role } from '@car-rental/shared';

// How a role reads in the interface (profile badge, sidebar user card).
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  EMPLOYEE: 'Employé',
};
