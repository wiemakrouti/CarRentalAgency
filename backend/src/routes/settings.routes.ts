import { Router } from 'express';
import { updateSettingsSchema } from '@car-rental/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { uploadAgencyLogo } from '../middleware/upload.js';
import { asyncHandler } from '../utils/async-handler.js';
import { SettingsController } from '../controllers/settings.controller.js';

export const settingsRouter = Router();

// No authorize(['ADMIN']) beyond `authenticate` — every account is the
// ADMIN role (see CLAUDE.md: one admin per agency), so gating on role here
// would add a check that can never actually deny anyone. `authenticate`
// alone is still what scopes every request to the caller's own agencyId.
settingsRouter.get('/settings', authenticate, asyncHandler(SettingsController.get));
settingsRouter.patch(
  '/settings',
  authenticate,
  validate({ body: updateSettingsSchema }),
  asyncHandler(SettingsController.update),
);
settingsRouter.post(
  '/settings/logo',
  authenticate,
  uploadAgencyLogo,
  asyncHandler(SettingsController.uploadLogo),
);
