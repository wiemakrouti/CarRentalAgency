import type { Request, Response } from 'express';
import type { CreateCarInput, UpdateCarInput } from '@car-rental/shared';
import { AppError } from '../utils/app-error.js';
import { CarsService } from '../services/cars.service.js';
import type { AvailableQuery, CarListQuery } from '../validators/car.validator.js';

export const CarsController = {
  async list(req: Request, res: Response) {
    const query = req.query as unknown as CarListQuery;
    const result = await CarsService.list(query);
    res.status(200).json({
      success: true,
      data: result.items,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  },

  async available(req: Request, res: Response) {
    const query = req.query as unknown as AvailableQuery;
    const cars = await CarsService.getAvailable(query);
    res.status(200).json({ success: true, data: cars });
  },

  async getById(req: Request, res: Response) {
    const car = await CarsService.getById(req.params.id!);
    res.status(200).json({ success: true, data: car });
  },

  async create(req: Request, res: Response) {
    const input = req.body as CreateCarInput;
    const car = await CarsService.create(input, req.user!.id, req.ip);
    res.status(201).json({ success: true, data: car });
  },

  async update(req: Request, res: Response) {
    const input = req.body as UpdateCarInput;
    const car = await CarsService.update(req.params.id!, input, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: car });
  },

  async archive(req: Request, res: Response) {
    const car = await CarsService.archive(req.params.id!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: car });
  },

  async restore(req: Request, res: Response) {
    const car = await CarsService.restore(req.params.id!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: car });
  },

  async uploadImage(req: Request, res: Response) {
    if (!req.file) {
      throw new AppError(400, 'IMAGE_REQUIRED', 'Un fichier image est requis.');
    }
    const isPrimary = req.body.isPrimary === 'true';
    const image = await CarsService.addImage(req.params.id!, req.file, isPrimary, req.user!.id, req.ip);
    res.status(201).json({ success: true, data: image });
  },

  async deleteImage(req: Request, res: Response) {
    await CarsService.removeImage(req.params.id!, req.params.imageId!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: { deleted: true } });
  },

  async setPrimaryImage(req: Request, res: Response) {
    const image = await CarsService.setPrimaryImage(req.params.id!, req.params.imageId!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: image });
  },
};
