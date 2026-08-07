import { z } from 'zod';

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
