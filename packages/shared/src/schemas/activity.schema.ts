import { z } from 'zod';

// The director's activity journal groups audit entries by what they touch.
// `account` covers sign-ins and password/session changes — kept apart so the
// day-to-day work isn't buried under them. `approvals` is the requests that
// waited for the director (asked, approved, refused, withdrawn).
export const ACTIVITY_CATEGORIES = [
  'approvals',
  'rentals',
  'payments',
  'expenses',
  'clients',
  'cars',
  'team',
  'settings',
  'account',
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  userId: z.string().uuid().optional(),
  category: z.enum(ACTIVITY_CATEGORIES).optional(),
  // Date-only strings (YYYY-MM-DD), both inclusive.
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ActivityQuery = z.infer<typeof activityQuerySchema>;
