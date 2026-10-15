import type { Role } from './enums.js';

// What each role may do — the one place this is decided. The backend's
// authorizePermission() enforces it on the routes; the frontend's useCan()
// reads the same list to hide what a role can't use. Anything not listed
// here is open to every signed-in member of the agency.
//
// The employee runs the whole day-to-day work (rentals, clients, cars,
// payments, deposits, expenses, finances); the director keeps the actions
// that manage the team, change the agency itself, or would erase a trace of
// what happened — and decides on the three actions an employee can only
// request (a car's catalogue rate, a large expense, a large discount).
export const PERMISSIONS = {
  'team.manage': ['ADMIN'],
  // The whole agency's activity journal; everyone else sees only their own.
  'audit.view': ['ADMIN'],
  'settings.update': ['ADMIN'],
  'car.delete': ['ADMIN'],
  'client.delete': ['ADMIN'],
  'payment.archive': ['ADMIN'],
  'expense.archive': ['ADMIN'],
  'approval.decide': ['ADMIN'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
