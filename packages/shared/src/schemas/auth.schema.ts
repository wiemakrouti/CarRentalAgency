import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

export type LoginInput = z.infer<typeof loginSchema>;
