import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { RemindersController } from '../controllers/reminders.controller.js';
import { remindersQuerySchema } from '../validators/reminders.validator.js';

export const remindersRouter = Router();

remindersRouter.get(
  '/reminders',
  authenticate,
  authorize('ADMIN'),
  validate({ query: remindersQuerySchema }),
  asyncHandler(RemindersController.list),
);
