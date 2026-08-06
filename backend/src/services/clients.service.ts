import { Prisma } from '@prisma/client';
import type { ClientDocumentType, CreateClientInput, UpdateClientInput } from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { AppError } from '../utils/app-error.js';
import { deleteCloudinaryImage, isCloudinaryConfigured, uploadImageBuffer } from '../lib/cloudinary-client.js';
import { ClientsRepository } from '../repositories/clients.repository.js';
import { AuditService } from './audit.service.js';
import type { ClientListQuery } from '../validators/client.validator.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

function toDuplicateEmailError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_CONSTRAINT_VIOLATION) {
    throw new AppError(409, 'DUPLICATE_EMAIL', 'Un client avec cette adresse email existe déjà.');
  }
  throw err;
}

export const ClientsService = {
  async list(query: ClientListQuery) {
    const { items, total } = await ClientsRepository.findMany(query);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(id: string, options?: { includeArchived?: boolean }) {
    const client = await ClientsRepository.findById(id, options);
    if (!client) {
      throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client introuvable.');
    }
    return client;
  },

  async create(input: CreateClientInput, userId: string, ipAddress?: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const client = await ClientsRepository.create(input, tx);
        await AuditService.record(tx, {
          userId,
          action: 'CREATE',
          entityType: 'Client',
          entityId: client.id,
          after: client,
          ipAddress,
        });
        return client;
      });
    } catch (err) {
      toDuplicateEmailError(err);
    }
  },

  async update(id: string, input: UpdateClientInput, userId: string, ipAddress?: string) {
    const existing = await ClientsService.getById(id);
    try {
      return await prisma.$transaction(async (tx) => {
        const updated = await ClientsRepository.update(id, input, tx);
        await AuditService.record(tx, {
          userId,
          action: 'UPDATE',
          entityType: 'Client',
          entityId: id,
          before: existing,
          after: updated,
          ipAddress,
        });
        return updated;
      });
    } catch (err) {
      toDuplicateEmailError(err);
    }
  },

  async archive(id: string, userId: string, ipAddress?: string) {
    await ClientsService.getById(id);
    return prisma.$transaction(async (tx) => {
      const archived = await ClientsRepository.archiveById(id, tx);
      await AuditService.record(tx, {
        userId,
        action: 'DELETE',
        entityType: 'Client',
        entityId: id,
        ipAddress,
      });
      return archived;
    });
  },

  async restore(id: string, userId: string, ipAddress?: string) {
    await ClientsService.getById(id, { includeArchived: true });
    return prisma.$transaction(async (tx) => {
      const restored = await ClientsRepository.restoreById(id, tx);
      await AuditService.record(tx, {
        userId,
        action: 'RESTORE',
        entityType: 'Client',
        entityId: id,
        ipAddress,
      });
      return restored;
    });
  },

  async addDocument(
    clientId: string,
    file: { buffer: Buffer },
    type: ClientDocumentType,
    expiryDate: Date | null,
    userId: string,
    ipAddress?: string,
  ) {
    if (!isCloudinaryConfigured()) {
      throw new AppError(503, 'IMAGE_STORAGE_NOT_CONFIGURED', "Le stockage d'images n'est pas configuré.");
    }

    await ClientsService.getById(clientId);

    const uploaded = await uploadImageBuffer(file.buffer, `clients/${clientId}`);

    return prisma.$transaction(async (tx) => {
      const document = await ClientsRepository.addDocument(
        clientId,
        { type, url: uploaded.url, publicId: uploaded.publicId, expiryDate },
        tx,
      );
      await AuditService.record(tx, {
        userId,
        action: 'CLIENT_DOCUMENT_ADD',
        entityType: 'Client',
        entityId: clientId,
        after: { documentId: document.id, type, url: document.url },
        ipAddress,
      });
      return document;
    });
  },

  async removeDocument(clientId: string, documentId: string, userId: string, ipAddress?: string) {
    const document = await ClientsRepository.findDocumentById(documentId);
    if (!document || document.clientId !== clientId) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document introuvable.');
    }

    await prisma.$transaction(async (tx) => {
      await ClientsRepository.deleteDocumentById(documentId, tx);
      await AuditService.record(tx, {
        userId,
        action: 'CLIENT_DOCUMENT_REMOVE',
        entityType: 'Client',
        entityId: clientId,
        before: { documentId, url: document.url },
        ipAddress,
      });
    });

    try {
      await deleteCloudinaryImage(document.publicId);
    } catch (err) {
      console.error(`Failed to delete Cloudinary asset ${document.publicId}:`, err);
    }
  },
};
