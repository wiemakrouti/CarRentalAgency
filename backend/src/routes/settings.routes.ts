import { Router } from 'express';
import { updateSettingsSchema } from '@car-rental/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizePermission } from '../middleware/authorize.js';
import { uploadAgencyLogo } from '../middleware/upload.js';
import { asyncHandler } from '../utils/async-handler.js';
import { SettingsController } from '../controllers/settings.controller.js';

export const settingsRouter = Router();

// Everyone reads the settings (currency, agency name, logo shown across the
// app); only the director changes them.
settingsRouter.get('/settings', authenticate, asyncHandler(SettingsController.get));
settingsRouter.patch(
  '/settings',
  authenticate,
  authorizePermission('settings.update'),
  validate({ body: updateSettingsSchema }),
  asyncHandler(SettingsController.update),
);
settingsRouter.post(
  '/settings/logo',
  authenticate,
  authorizePermission('settings.update'),
  uploadAgencyLogo,
  asyncHandler(SettingsController.uploadLogo),
);
