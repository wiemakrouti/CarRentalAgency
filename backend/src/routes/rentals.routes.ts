import { Router } from 'express';
import {
  activateRentalSchema,
  cancelRentalSchema,
  createRentalSchema,
  extendRentalSchema,
  returnRentalSchema,
} from '@car-rental/shared';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { RentalsController } from '../controllers/rentals.controller.js';
import { rentalIdParamSchema, rentalListQuerySchema } from '../validators/rental.validator.js';

export const rentalsRouter = Router();

rentalsRouter.use('/rentals', authenticate, authorize('ADMIN'));

rentalsRouter.get('/rentals', validate({ query: rentalListQuerySchema }), asyncHandler(RentalsController.list));
rentalsRouter.post('/rentals', validate({ body: createRentalSchema }), asyncHandler(RentalsController.create));
rentalsRouter.get(
  '/rentals/:id',
  validate({ params: rentalIdParamSchema }),
  asyncHandler(RentalsController.getById),
);
rentalsRouter.post(
  '/rentals/:id/activate',
  validate({ params: rentalIdParamSchema, body: activateRentalSchema }),
  asyncHandler(RentalsController.activate),
);
rentalsRouter.post(
  '/rentals/:id/return',
  validate({ params: rentalIdParamSchema, body: returnRentalSchema }),
  asyncHandler(RentalsController.returnRental),
);
rentalsRouter.post(
  '/rentals/:id/extend',
  validate({ params: rentalIdParamSchema, body: extendRentalSchema }),
  asyncHandler(RentalsController.extend),
);
rentalsRouter.post(
  '/rentals/:id/cancel',
  validate({ params: rentalIdParamSchema, body: cancelRentalSchema }),
  asyncHandler(RentalsController.cancel),
);
