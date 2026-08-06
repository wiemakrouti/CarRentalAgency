import type { Request, Response } from 'express';
import { CLIENT_DOCUMENT_TYPES, type CreateClientInput, type UpdateClientInput } from '@car-rental/shared';
import { AppError } from '../utils/app-error.js';
import { ClientsService } from '../services/clients.service.js';
import type { ClientListQuery } from '../validators/client.validator.js';

export const ClientsController = {
  async list(req: Request, res: Response) {
    const query = req.query as unknown as ClientListQuery;
    const result = await ClientsService.list(query);
    res.status(200).json({
      success: true,
      data: result.items,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  },

  async getById(req: Request, res: Response) {
    const client = await ClientsService.getById(req.params.id!);
    res.status(200).json({ success: true, data: client });
  },

  async create(req: Request, res: Response) {
    const input = req.body as CreateClientInput;
    const client = await ClientsService.create(input, req.user!.id, req.ip);
    res.status(201).json({ success: true, data: client });
  },

  async update(req: Request, res: Response) {
    const input = req.body as UpdateClientInput;
    const client = await ClientsService.update(req.params.id!, input, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: client });
  },

  async archive(req: Request, res: Response) {
    const client = await ClientsService.archive(req.params.id!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: client });
  },

  async restore(req: Request, res: Response) {
    const client = await ClientsService.restore(req.params.id!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: client });
  },

  async uploadDocument(req: Request, res: Response) {
    if (!req.file) {
      throw new AppError(400, 'DOCUMENT_REQUIRED', 'Un fichier est requis.');
    }

    const type = req.body.type;
    if (!CLIENT_DOCUMENT_TYPES.includes(type)) {
      throw new AppError(400, 'INVALID_DOCUMENT_TYPE', 'Type de document invalide.');
    }

    const expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;

    const document = await ClientsService.addDocument(
      req.params.id!,
      req.file,
      type,
      expiryDate,
      req.user!.id,
      req.ip,
    );
    res.status(201).json({ success: true, data: document });
  },

  async deleteDocument(req: Request, res: Response) {
    await ClientsService.removeDocument(req.params.id!, req.params.documentId!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: { deleted: true } });
  },
};
