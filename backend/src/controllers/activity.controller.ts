import type { Request, Response } from 'express';
import type { ActivityQuery } from '@car-rental/shared';
import { ActivityService } from '../services/activity.service.js';

export const ActivityController = {
  async list(req: Request, res: Response) {
    const query = req.query as unknown as ActivityQuery;
    const result = await ActivityService.list(req.user!.agencyId, req.user!, query);
    res.status(200).json({
      success: true,
      data: result.items,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  },
};
