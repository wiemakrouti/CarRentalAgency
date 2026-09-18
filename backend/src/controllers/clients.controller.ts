import type { Request, Response } from 'express';
import {
  CLIENT_DOCUMENT_TYPES,
  type CreateClientInput,
  type UpdateClientInput,
} from '@car-rental/shared';
import { AppError } from '../utils/app-error.js';
import { ClientsService } from '../services/clients.service.js';
import type {
  ClientCheckPhoneQuery,
  ClientExportQuery,
  ClientListQuery,
} from '../validators/client.validator.js';

export const ClientsController = {
  async list(req: Request, res: Response) {
    const query = req.query as unknown as ClientListQuery;
    const result = await ClientsService.list(req.user!.agencyId, query);
    res.status(200).json({
      success: true,
      data: result.items,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  },

  async exportCsv(req: Request, res: Response) {
    const query = req.query as unknown as ClientExportQuery;
    const csv = await ClientsService.exportCsv(req.user!.agencyId, query);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="clients-${date}.csv"`);
    res.status(200).send(csv);
  },

  async exportXlsx(req: Request, res: Response) {
    const query = req.query as unknown as ClientExportQuery;
    const buffer = await ClientsService.exportXlsx(req.user!.agencyId, query);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="clients-${date}.xlsx"`);
    res.status(200).send(buffer);
  },

  async checkPhoneDuplicate(req: Request, res: Response) {
    const { phone, excludeId } = req.query as unknown as ClientCheckPhoneQuery;
    const matches = await ClientsService.checkPhoneDuplicate(req.user!.agencyId, phone, excludeId);
    res.status(200).json({ success: true, data: matches });
  },

  async getById(req: Request, res: Response) {
    const client = await ClientsService.getById(req.user!.agencyId, req.params.id!);
    res.status(200).json({ success: true, data: client });
  },

  async getStats(req: Request, res: Response) {
    const stats = await ClientsService.getStats(req.user!.agencyId, req.params.id!);
    res.status(200).json({ success: true, data: stats });
  },

  async create(req: Request, res: Response) {
    const input = req.body as CreateClientInput;
    const client = await ClientsService.create(req.user!.agencyId, input, req.user!.id, req.ip);
    res.status(201).json({ success: true, data: client });
  },

  async update(req: Request, res: Response) {
    const input = req.body as UpdateClientInput;
    const client = await ClientsService.update(
      req.user!.agencyId,
      req.params.id!,
      input,
      req.user!.id,
      req.ip,
    );
    res.status(200).json({ success: true, data: client });
  },

  async checkDeletable(req: Request, res: Response) {
    const result = await ClientsService.checkDeletable(req.user!.agencyId, req.params.id!);
    res.status(200).json({ success: true, data: result });
  },

  async delete(req: Request, res: Response) {
    await ClientsService.delete(req.user!.agencyId, req.params.id!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: { deleted: true } });
  },

  async uploadDocument(req: Request, res: Response) {
    if (!req.file) {
      throw new AppError(400, 'DOCUMENT_REQUIRED', 'Un fichier est requis.');
    }

    const type = req.body.type;
    if (!CLIENT_DOCUMENT_TYPES.includes(type)) {
      throw new AppError(400, 'INVALID_DOCUMENT_TYPE', 'Type de document invalide.');
    }

    const document = await ClientsService.addDocument(
      req.user!.agencyId,
      req.params.id!,
      req.file,
      type,
      req.user!.id,
      req.ip,
    );
    res.status(201).json({ success: true, data: document });
  },

  async deleteDocument(req: Request, res: Response) {
    await ClientsService.removeDocument(
      req.user!.agencyId,
      req.params.id!,
      req.params.documentId!,
      req.user!.id,
      req.ip,
    );
    res.status(200).json({ success: true, data: { deleted: true } });
  },
};
