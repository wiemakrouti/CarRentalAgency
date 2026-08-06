import { z } from 'zod';
import { CAR_CATEGORIES, CAR_STATUSES, FUEL_TYPES, TRANSMISSIONS } from '../enums.js';

const currentYear = new Date().getFullYear();

export const createCarSchema = z.object({
  licensePlate: z.string().trim().min(1, "L'immatriculation est requise"),
  vin: z.string().trim().min(1).nullable().optional(),
  brand: z.string().trim().min(1, 'La marque est requise'),
  model: z.string().trim().min(1, 'Le modèle est requis'),
  year: z.coerce.number().int().min(1990).max(currentYear + 1, 'Année invalide'),
  color: z.string().trim().min(1, 'La couleur est requise'),
  category: z.enum(CAR_CATEGORIES),
  transmission: z.enum(TRANSMISSIONS),
  fuelType: z.enum(FUEL_TYPES),
  seats: z.coerce.number().int().min(1).max(60),
  mileage: z.coerce.number().int().min(0, 'Le kilométrage ne peut pas être négatif'),
  dailyRate: z.coerce.number().positive('Le tarif journalier doit être positif'),
  purchaseDate: z.coerce.date().nullable().optional(),
  purchasePrice: z.coerce.number().nonnegative().nullable().optional(),
  insuranceExpiryDate: z.coerce.date().nullable().optional(),
  technicalInspectionExpiryDate: z.coerce.date().nullable().optional(),
  registrationExpiryDate: z.coerce.date().nullable().optional(),
});

export type CreateCarInput = z.infer<typeof createCarSchema>;

export const updateCarSchema = createCarSchema.partial().extend({
  status: z.enum(CAR_STATUSES).optional(),
});

export type UpdateCarInput = z.infer<typeof updateCarSchema>;
