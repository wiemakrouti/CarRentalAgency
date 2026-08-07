import type { Request, Response } from 'express';
import type {
  ActivateRentalInput,
  CancelRentalInput,
  CreateRentalInput,
  ExtendRentalInput,
  ReturnRentalInput,
} from '@car-rental/shared';
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

  async activate(req: Request, res: Response) {
    const input = req.body as ActivateRentalInput;
    const rental = await RentalsService.activate(req.params.id!, input, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: rental });
  },

  async returnRental(req: Request, res: Response) {
    const input = req.body as ReturnRentalInput;
    const rental = await RentalsService.returnRental(req.params.id!, input, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: rental });
  },

  async extend(req: Request, res: Response) {
    const input = req.body as ExtendRentalInput;
    const rental = await RentalsService.extend(req.params.id!, input, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: rental });
  },

  async cancel(req: Request, res: Response) {
    const input = req.body as CancelRentalInput;
    const rental = await RentalsService.cancel(req.params.id!, input, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: rental });
  },
};
