import type { Request, Response } from 'express';
import type { CreateRentalInput } from '@car-rental/shared';
import { RentalsService } from '../services/rentals.service.js';
import type { RentalListQuery } from '../validators/rental.validator.js';

export const RentalsController = {
  async list(req: Request, res: Response) {
    const query = req.query as unknown as RentalListQuery;
    const result = await RentalsService.list(query);
    res.status(200).json({
      success: true,
      data: result.items,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  },

  async getById(req: Request, res: Response) {
    const rental = await RentalsService.getById(req.params.id!);
    res.status(200).json({ success: true, data: rental });
  },

  async create(req: Request, res: Response) {
    const input = req.body as CreateRentalInput;
    const rental = await RentalsService.create(input, req.user!.id, req.ip);
    res.status(201).json({ success: true, data: rental });
  },
};
