import type { Request, Response } from 'express';
import type { UpdateSettingsInput } from '@car-rental/shared';
import { AppError } from '../utils/app-error.js';
import { SettingsService } from '../services/settings.service.js';

export const SettingsController = {
  async get(req: Request, res: Response) {
    const settings = await SettingsService.get(req.user!.agencyId);
    res.status(200).json({ success: true, data: settings });
  },

  async update(req: Request, res: Response) {
    const input = req.body as UpdateSettingsInput;
    const settings = await SettingsService.update(req.user!.agencyId, input, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: settings });
  },

  async uploadLogo(req: Request, res: Response) {
    if (!req.file) {
      throw new AppError(400, 'IMAGE_REQUIRED', 'Un fichier image est requis.');
    }
    const settings = await SettingsService.uploadLogo(
      req.user!.agencyId,
      req.file,
      req.user!.id,
      req.ip,
    );
    res.status(200).json({ success: true, data: settings });
  },
};
