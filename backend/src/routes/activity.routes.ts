import { Router } from 'express';
import { activityQuerySchema } from '@car-rental/shared';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ActivityController } from '../controllers/activity.controller.js';

// The activity journal: the director's supervision of the whole agency;
// for an employee, "Mon activité" — their own actions only
// (ActivityService.list).
export const activityRouter = Router();

activityRouter.use('/activity', authenticate);

activityRouter.get('/activity', validate({ query: activityQuerySchema }), asyncHandler(ActivityController.list));
