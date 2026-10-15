import { Router } from 'express';
import { approvalListQuerySchema } from '@car-rental/shared';
import { authenticate } from '../middleware/authenticate.js';
import { authorizePermission } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { approvalIdParamSchema } from '../validators/approval.validator.js';
import { ApprovalsController } from '../controllers/approvals.controller.js';

// Requests waiting for the director (see ApprovalsService). Everyone signed
// in may list (the director: all of them; an employee: their own) and
// withdraw their own; only the director decides.
export const approvalsRouter = Router();

approvalsRouter.use('/approvals', authenticate);

approvalsRouter.get('/approvals', validate({ query: approvalListQuerySchema }), asyncHandler(ApprovalsController.list));
approvalsRouter.post('/approvals/seen', asyncHandler(ApprovalsController.markSeen));
approvalsRouter.post(
  '/approvals/:id/approve',
  authorizePermission('approval.decide'),
  validate({ params: approvalIdParamSchema }),
  asyncHandler(ApprovalsController.approve),
);
approvalsRouter.post(
  '/approvals/:id/reject',
  authorizePermission('approval.decide'),
  validate({ params: approvalIdParamSchema }),
  asyncHandler(ApprovalsController.reject),
);
approvalsRouter.post(
  '/approvals/:id/withdraw',
  validate({ params: approvalIdParamSchema }),
  asyncHandler(ApprovalsController.withdraw),
);
