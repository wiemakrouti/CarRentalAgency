import { Router } from 'express';
import {
  activateRentalSchema,
  cancelRentalSchema,
  createRentalSchema,
  extendRentalSchema,
  returnRentalSchema,
} from '@car-rental/shared';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { RentalsController } from '../controllers/rentals.controller.js';
import {
  rentalIdParamSchema,
  rentalListQuerySchema,
  rentalPlanningQuerySchema,
} from '../validators/rental.validator.js';

export const rentalsRouter = Router();

// Every member of the agency (director and employees) — `authenticate` scopes
// each request to the caller's agency; director-only actions add
// authorizePermission() below.
rentalsRouter.use('/rentals', authenticate);

rentalsRouter.get('/rentals', validate({ query: rentalListQuerySchema }), asyncHandler(RentalsController.list));
rentalsRouter.post('/rentals', validate({ body: createRentalSchema }), asyncHandler(RentalsController.create));
// Must come before /rentals/:id — otherwise "summary" is captured as :id
// and fails UUID validation instead of reaching this handler.
rentalsRouter.get('/rentals/summary', asyncHandler(RentalsController.getSummary));
// Same reasoning as /rentals/summary above — "to-collect" would otherwise be
// captured as :id.
rentalsRouter.get('/rentals/to-collect', asyncHandler(RentalsController.getToCollect));
// Same reasoning as /rentals/summary above — "planning" would otherwise be
// captured as :id.
rentalsRouter.get(
  '/rentals/planning',
  validate({ query: rentalPlanningQuerySchema }),
  asyncHandler(RentalsController.getPlanning),
);
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
