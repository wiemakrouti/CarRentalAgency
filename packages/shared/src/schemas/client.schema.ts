import { z } from 'zod';

export const createClientSchema = z.object({
  firstName: z.string().trim().min(1, 'Le prénom est requis'),
  lastName: z.string().trim().min(1, 'Le nom est requis'),
  email: z.string().trim().email('Adresse email invalide').nullable().optional(),
  phone: z.string().trim().min(1, 'Le téléphone est requis'),
  address: z.string().trim().min(1).nullable().optional(),
  city: z.string().trim().min(1).nullable().optional(),
  nationalIdNumber: z.string().trim().min(1).nullable().optional(),
  drivingLicenseNumber: z.string().trim().min(1, 'Le numéro de permis est requis'),
  drivingLicenseExpiry: z.coerce.date().nullable().optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial().extend({
  blacklisted: z.boolean().optional(),
});

export type UpdateClientInput = z.infer<typeof updateClientSchema>;
