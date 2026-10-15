import type { Request, Response } from 'express';
import type { CreateEmployeeInput, ResetEmployeePasswordInput, UpdateEmployeeInput } from '@car-rental/shared';
import { TeamService } from '../services/team.service.js';

function actor(req: Request) {
  return { id: req.user!.id, agencyId: req.user!.agencyId };
}

function meta(req: Request) {
  return { ipAddress: req.ip };
}

export const TeamController = {
  async list(req: Request, res: Response) {
    const members = await TeamService.list(req.user!.agencyId);
    res.status(200).json({ success: true, data: members });
  },

  async create(req: Request, res: Response) {
    const member = await TeamService.createEmployee(actor(req), req.body as CreateEmployeeInput, meta(req));
    res.status(201).json({ success: true, data: member });
  },

  async update(req: Request, res: Response) {
    const member = await TeamService.updateEmployee(
      actor(req),
      req.params.id!,
      req.body as UpdateEmployeeInput,
      meta(req),
    );
    res.status(200).json({ success: true, data: member });
  },

  async deactivate(req: Request, res: Response) {
    const member = await TeamService.deactivate(actor(req), req.params.id!, meta(req));
    res.status(200).json({ success: true, data: member });
  },

  async reactivate(req: Request, res: Response) {
    const member = await TeamService.reactivate(actor(req), req.params.id!, meta(req));
    res.status(200).json({ success: true, data: member });
  },

  async resetPassword(req: Request, res: Response) {
    const member = await TeamService.resetPassword(
      actor(req),
      req.params.id!,
      req.body as ResetEmployeePasswordInput,
      meta(req),
    );
    res.status(200).json({ success: true, data: member });
  },
};
