import { z } from 'zod';
import { MANUALLY_SETTABLE_CAR_STATUSES } from '../enums.js';

export const createRentalSchema = z
  .object({
    carId: z.string().uuid(),
    clientId: z.string().uuid(),
    pickupDate: z.coerce.date(),
    plannedReturnDate: z.coerce.date(),
    depositAmount: z.coerce.number().nonnegative('Le dépôt doit être positif').optional(),
    notes: z.string().trim().min(1).nullable().optional(),
  })
  .refine((data) => data.plannedReturnDate > data.pickupDate, {
    message: 'La date de retour doit être après la date de prise en charge.',
    path: ['plannedReturnDate'],
  });

export type CreateRentalInput = z.infer<typeof createRentalSchema>;

export const activateRentalSchema = z.object({
  mileageAtPickup: z.coerce.number().int().nonnegative('Le kilométrage doit être positif.'),
  fuelLevelAtPickup: z.string().trim().min(1, 'Le niveau de carburant est requis.'),
});

export type ActivateRentalInput = z.infer<typeof activateRentalSchema>;

export const returnRentalSchema = z.object({
  mileageAtReturn: z.coerce.number().int().nonnegative('Le kilométrage doit être positif.'),
  fuelLevelAtReturn: z.string().trim().min(1, 'Le niveau de carburant est requis.'),
  damageFeeAmount: z.coerce.number().positive('Le montant des dommages doit être positif.').optional(),
  damageFeeNotes: z.string().trim().min(1).optional(),
  // What the car becomes once this rental closes — AVAILABLE by default, but
  // MAINTENANCE/OUT_OF_SERVICE when the return itself is why the car needs
  // to come out of rotation (e.g. it broke down during the rental). This is
  // the only path that may take a car out of RENTED — see
  // docs/architecture.md § Car status.
  carStatusAfterReturn: z.enum(MANUALLY_SETTABLE_CAR_STATUSES).default('AVAILABLE'),
});

export type ReturnRentalInput = z.infer<typeof returnRentalSchema>;

export const extendRentalSchema = z.object({
  newReturnDate: z.coerce.date(),
});

export type ExtendRentalInput = z.infer<typeof extendRentalSchema>;

export const cancelRentalSchema = z.object({
  cancelledReason: z.string().trim().min(1).optional(),
});

export type CancelRentalInput = z.infer<typeof cancelRentalSchema>;
