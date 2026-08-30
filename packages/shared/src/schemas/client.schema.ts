import { z } from 'zod';

// Shared by both create and update — kept lenient (nullable/optional) for
// every field except the always-required identity fields (name, phone,
// license number), since `updateClientSchema` derives from this directly and
// a lot of existing client records were created before address/CIN/date of
// birth became mandatory on the *create* form. Partial updates must still be
// able to save those legacy rows without forcing every field to be filled in
// first.
const baseClientFields = z.object({
  firstName: z.string().trim().min(1, 'Le prénom est requis'),
  lastName: z.string().trim().min(1, 'Le nom est requis'),
  email: z.string().trim().email('Adresse email invalide').nullable().optional(),
  phone: z.string().trim().min(1, 'Le téléphone est requis'),
  nationality: z.string().trim().min(1).nullable().optional(),
  address: z.string().trim().min(1).nullable().optional(),
  city: z.string().trim().min(1).nullable().optional(),
  nationalIdNumber: z.string().trim().min(1).nullable().optional(),
  drivingLicenseNumber: z.string().trim().min(1, 'Le numéro de permis est requis'),
  drivingLicenseExpiry: z.coerce.date().nullable().optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});

// New clients must have an address, a CIN number, and a date of birth —
// overridden here (required, non-nullable) on top of the lenient base above,
// which `updateClientSchema` keeps untouched.
export const createClientSchema = baseClientFields.extend({
  address: z.string({ invalid_type_error: "L'adresse est requise" }).trim().min(1, "L'adresse est requise"),
  nationalIdNumber: z
    .string({ invalid_type_error: 'Le numéro de CIN est requis' })
    .trim()
    .min(1, 'Le numéro de CIN est requis'),
  // z.coerce.date(), not z.date() — this schema validates both the
  // frontend's already-a-Date form value AND the raw JSON string the
  // backend receives over the wire (Date.toJSON() serializes to an ISO
  // string; a plain z.date() would reject that as the wrong type).
  dateOfBirth: z.coerce.date({
    required_error: 'La date de naissance est requise',
    invalid_type_error: 'La date de naissance est requise',
  }),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = baseClientFields.partial();

export type UpdateClientInput = z.infer<typeof updateClientSchema>;
