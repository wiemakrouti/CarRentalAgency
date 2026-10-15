import { Router } from 'express';
import { createEmployeeSchema, resetEmployeePasswordSchema, updateEmployeeSchema } from '@car-rental/shared';
import { authenticate } from '../middleware/authenticate.js';
import { authorizePermission } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { TeamController } from '../controllers/team.controller.js';
import { userIdParamSchema } from '../validators/user.validator.js';

// The director's team management — admin only.
export const teamRouter = Router();

teamRouter.use('/users', authenticate, authorizePermission('team.manage'));

teamRouter.get('/users', asyncHandler(TeamController.list));
teamRouter.post('/users', validate({ body: createEmployeeSchema }), asyncHandler(TeamController.create));
teamRouter.patch(
  '/users/:id',
  validate({ params: userIdParamSchema, body: updateEmployeeSchema }),
  asyncHandler(TeamController.update),
);
teamRouter.post(
  '/users/:id/deactivate',
  validate({ params: userIdParamSchema }),
  asyncHandler(TeamController.deactivate),
);
teamRouter.post(
  '/users/:id/reactivate',
  validate({ params: userIdParamSchema }),
  asyncHandler(TeamController.reactivate),
);
teamRouter.post(
  '/users/:id/reset-password',
  validate({ params: userIdParamSchema, body: resetEmployeePasswordSchema }),
  asyncHandler(TeamController.resetPassword),
);
