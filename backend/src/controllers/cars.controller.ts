import type { Request, Response } from 'express';
import type { CreateCarInput, UpdateCarInput } from '@car-rental/shared';
import { AppError } from '../utils/app-error.js';
import { CarsService } from '../services/cars.service.js';
import type {
  AvailableQuery,
  BulkCarIdsInput,
  BulkCarStatusInput,
  CarExportQuery,
  CarListQuery,
} from '../validators/car.validator.js';

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

  async exportCsv(req: Request, res: Response) {
    const query = req.query as unknown as CarExportQuery;
    const csv = await CarsService.exportCsv(query);
    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="voitures.csv"');
    res.send(csv);
  },

  async exportXlsx(req: Request, res: Response) {
    const query = req.query as unknown as CarExportQuery;
    const buffer = await CarsService.exportXlsx(query);
    res.status(200);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="voitures.xlsx"');
    res.send(buffer);
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

  async getStats(req: Request, res: Response) {
    const stats = await CarsService.getStats(req.params.id!);
    res.status(200).json({ success: true, data: stats });
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

  async checkDeletable(req: Request, res: Response) {
    const result = await CarsService.checkDeletable(req.params.id!);
    res.status(200).json({ success: true, data: result });
  },

  async delete(req: Request, res: Response) {
    await CarsService.delete(req.params.id!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: { deleted: true } });
  },

  async uploadImage(req: Request, res: Response) {
    if (!req.file) {
      throw new AppError(400, 'IMAGE_REQUIRED', 'Un fichier image est requis.');
    }
    const isPrimary = req.body.isPrimary === 'true';
    const image = await CarsService.addImage(
      req.params.id!,
      req.file,
      isPrimary,
      req.user!.id,
      req.ip,
    );
    res.status(201).json({ success: true, data: image });
  },

  async deleteImage(req: Request, res: Response) {
    await CarsService.removeImage(req.params.id!, req.params.imageId!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: { deleted: true } });
  },

  async setPrimaryImage(req: Request, res: Response) {
    const image = await CarsService.setPrimaryImage(
      req.params.id!,
      req.params.imageId!,
      req.user!.id,
      req.ip,
    );
    res.status(200).json({ success: true, data: image });
  },

  async checkBulkDeletable(req: Request, res: Response) {
    const { ids } = req.body as BulkCarIdsInput;
    const result = await CarsService.checkBulkDeletable(ids);
    res.status(200).json({ success: true, data: result });
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body as BulkCarIdsInput;
    await CarsService.bulkDelete(ids, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: { deleted: true } });
  },

  async bulkUpdateStatus(req: Request, res: Response) {
    const { ids, status } = req.body as BulkCarStatusInput;
    const updated = await CarsService.bulkUpdateStatus(ids, status, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: updated });
  },
};
