import { z } from 'zod';

export const remindersQuerySchema = z.object({
  withinDays: z.coerce.number().int().positive().max(90).default(7),
});

export type RemindersQuery = z.infer<typeof remindersQuerySchema>;
