import { Router } from 'express';
import { loginSchema } from '@car-rental/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AuthController } from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/auth/login', validate({ body: loginSchema }), asyncHandler(AuthController.login));
authRouter.post('/auth/refresh', asyncHandler(AuthController.refresh));
authRouter.post('/auth/logout', authenticate, asyncHandler(AuthController.logout));
authRouter.get('/auth/me', authenticate, asyncHandler(AuthController.me));
