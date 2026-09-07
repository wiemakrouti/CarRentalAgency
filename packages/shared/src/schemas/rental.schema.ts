import { z } from 'zod';
import { MANUALLY_SETTABLE_CAR_STATUSES, PAYMENT_METHODS } from '../enums.js';

// Only these two make sense for a payment collected at booking time — the
// other PaymentTypes (DEPOSIT_REFUND, EXTENSION_PAYMENT, LATE_FEE,
// DAMAGE_FEE) are each generated later by a specific lifecycle event
// (return, extend, cancel) and could never apply to a rental that doesn't
// exist yet.
export const INITIAL_PAYMENT_TYPES = ['RENTAL_PAYMENT', 'DEPOSIT'] as const;
export type InitialPaymentType = (typeof INITIAL_PAYMENT_TYPES)[number];

export const activateRentalSchema = z.object({
  mileageAtPickup: z.coerce.number().int().nonnegative('Le kilométrage doit être positif.'),
  fuelLevelAtPickup: z.string().trim().min(1, 'Le niveau de carburant est requis.'),
});

export type ActivateRentalInput = z.infer<typeof activateRentalSchema>;

export const createRentalSchema = z
  .object({
    carId: z.string().uuid(),
    clientId: z.string().uuid(),
    pickupDate: z.coerce.date(),
    plannedReturnDate: z.coerce.date(),
    depositAmount: z.coerce.number().nonnegative('Le dépôt doit être positif').optional(),
    notes: z.string().trim().min(1).nullable().optional(),
    // A payment already collected at booking time (the "Location immédiate"
    // tab's own Paiement section) — created atomically alongside the rental
    // itself in RentalsService.create(), not as a separate follow-up call,
    // so a rental is never left referencing a payment that didn't actually
    // get created (or vice versa).
    initialPayment: z
      .object({
        amount: z.coerce.number().positive('Le montant doit être positif.'),
        type: z.enum(INITIAL_PAYMENT_TYPES),
        method: z.enum(PAYMENT_METHODS),
      })
      .optional(),
    // The "Location immédiate" tab's own remise-des-clés fields — when
    // present, RentalsService.create() moves the rental straight to ACTIVE
    // (and the car to RENTED) inside the same transaction as the creation,
    // exactly like a manual activate() would, instead of leaving a walk-in
    // client's rental sitting as RESERVED until a separate admin action.
    // Reuses activateRentalSchema's own shape — a same-day handover needs
    // the identical real-world inputs (mileage, fuel) a later activation
    // would, never fabricated defaults.
    activation: activateRentalSchema.optional(),
  })
  .refine((data) => data.plannedReturnDate > data.pickupDate, {
    message: 'La date de retour doit être après la date de prise en charge.',
    path: ['plannedReturnDate'],
  });

export type CreateRentalInput = z.infer<typeof createRentalSchema>;

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
