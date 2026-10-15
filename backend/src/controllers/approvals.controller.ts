import type { Request, Response } from 'express';
import type { ApprovalListQuery } from '@car-rental/shared';
import { ApprovalsService } from '../services/approvals.service.js';

export const ApprovalsController = {
  async list(req: Request, res: Response) {
    const query = req.query as unknown as ApprovalListQuery;
    const requests = await ApprovalsService.list(req.user!.agencyId, req.user!, query);
    res.status(200).json({ success: true, data: requests });
  },

  async markSeen(req: Request, res: Response) {
    await ApprovalsService.markDecisionsSeen(req.user!);
    res.status(200).json({ success: true, data: { seen: true } });
  },

  async approve(req: Request, res: Response) {
    const request = await ApprovalsService.approve(req.user!.agencyId, req.params.id!, req.user!, req.ip);
    res.status(200).json({ success: true, data: request });
  },

  async reject(req: Request, res: Response) {
    const request = await ApprovalsService.reject(req.user!.agencyId, req.params.id!, req.user!, req.ip);
    res.status(200).json({ success: true, data: request });
  },

  async withdraw(req: Request, res: Response) {
    const request = await ApprovalsService.withdraw(req.user!.agencyId, req.params.id!, req.user!, req.ip);
    res.status(200).json({ success: true, data: request });
  },
};
