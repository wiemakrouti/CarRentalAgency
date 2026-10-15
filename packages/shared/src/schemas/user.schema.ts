import { z } from 'zod';

// The director's team management (Équipe page). Employees are created with a
// temporary password the director hands over; they must replace it at their
// first login (User.mustChangePassword), so it only needs the usual minimum.
const temporaryPassword = z
  .string()
  .min(8, 'Le mot de passe provisoire doit contenir au moins 8 caractères')
  .max(100);

export const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(2, 'Le nom complet doit contenir au moins 2 caractères').max(100),
  email: z.string().trim().toLowerCase().email('Adresse email invalide'),
  temporaryPassword,
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = createEmployeeSchema.pick({ fullName: true, email: true });

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const resetEmployeePasswordSchema = z.object({ temporaryPassword });

export type ResetEmployeePasswordInput = z.infer<typeof resetEmployeePasswordSchema>;
