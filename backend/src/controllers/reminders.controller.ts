import type { Request, Response } from 'express';
import { RemindersService } from '../services/reminders.service.js';
import type { RemindersQuery } from '../validators/reminders.validator.js';

export const RemindersController = {
  async list(req: Request, res: Response) {
    const { withinDays } = req.query as unknown as RemindersQuery;
    const reminders = await RemindersService.getUpcoming(withinDays);
    res.status(200).json({ success: true, data: reminders });
  },
};
