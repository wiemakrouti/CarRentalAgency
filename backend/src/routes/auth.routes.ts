import { Router } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '@car-rental/shared';
import { validate } from '../middleware/validate.js';
import { authenticate, authenticateAccount } from '../middleware/authenticate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AuthController } from '../controllers/auth.controller.js';
import { sessionIdParamSchema } from '../validators/auth.validator.js';

export const authRouter = Router();

authRouter.post(
  '/auth/register',
  validate({ body: registerSchema }),
  asyncHandler(AuthController.register),
);
authRouter.post(
  '/auth/verify-email',
  validate({ body: verifyEmailSchema }),
  asyncHandler(AuthController.verifyEmail),
);
authRouter.post(
  '/auth/resend-verification',
  validate({ body: resendVerificationSchema }),
  asyncHandler(AuthController.resendVerification),
);
authRouter.post(
  '/auth/forgot-password',
  validate({ body: forgotPasswordSchema }),
  asyncHandler(AuthController.forgotPassword),
);
authRouter.post(
  '/auth/reset-password',
  validate({ body: resetPasswordSchema }),
  asyncHandler(AuthController.resetPassword),
);
authRouter.post('/auth/login', validate({ body: loginSchema }), asyncHandler(AuthController.login));
authRouter.post('/auth/refresh', asyncHandler(AuthController.refresh));
// authenticateAccount: still reachable while a temporary password is pending.
authRouter.post('/auth/logout', authenticateAccount, asyncHandler(AuthController.logout));
authRouter.get('/auth/me', authenticateAccount, asyncHandler(AuthController.me));
authRouter.patch(
  '/auth/me',
  authenticate,
  validate({ body: updateProfileSchema }),
  asyncHandler(AuthController.updateProfile),
);
authRouter.patch(
  '/auth/me/password',
  authenticateAccount,
  validate({ body: changePasswordSchema }),
  asyncHandler(AuthController.changePassword),
);
authRouter.get('/auth/sessions', authenticate, asyncHandler(AuthController.listSessions));
authRouter.delete(
  '/auth/sessions/:id',
  authenticate,
  validate({ params: sessionIdParamSchema }),
  asyncHandler(AuthController.revokeSession),
);
authRouter.post(
  '/auth/sessions/revoke-others',
  authenticate,
  asyncHandler(AuthController.revokeOtherSessions),
);
