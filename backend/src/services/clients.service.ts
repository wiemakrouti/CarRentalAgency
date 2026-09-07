import { Prisma } from '@prisma/client';
import type { Client } from '@prisma/client';
import type { ClientDocumentType, CreateClientInput, UpdateClientInput } from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { AppError } from '../utils/app-error.js';
import { toCsv } from '../utils/csv.js';
import { toXlsxBuffer } from '../utils/xlsx.js';
import { deleteCloudinaryImage, isCloudinaryConfigured, uploadImageBuffer } from '../lib/cloudinary-client.js';
import { ClientsRepository } from '../repositories/clients.repository.js';
import { AuditService } from './audit.service.js';
import type { ClientExportQuery, ClientListQuery } from '../validators/client.validator.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const FOREIGN_KEY_CONSTRAINT_VIOLATION = 'P2003';

function toDuplicateEmailError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_CONSTRAINT_VIOLATION) {
    throw new AppError(409, 'DUPLICATE_EMAIL', 'Un client avec cette adresse email existe déjà.');
  }
  throw err;
}

// assertNoHistory below is a plain read before the delete transaction — a
// rental created for this exact client in between (a genuine race, however
// narrow) would slip past it. The real backstop is this: Rental.clientId has
// no onDelete cascade, so Postgres itself refuses the delete with a foreign
// key violation if that happens — same fix as CarsService.toHasHistoryError.
function toHasHistoryError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === FOREIGN_KEY_CONSTRAINT_VIOLATION) {
    throw new AppError(409, 'CLIENT_HAS_HISTORY', CLIENT_HAS_HISTORY_MESSAGE);
  }
  throw err;
}

// Client has no soft-delete (see docs/architecture.md § Soft delete) — same
// guarded-hard-delete shape as CarsService (assertNoHistory/hasHistory
// above HAS_HISTORY_MESSAGE). A client with any rental (even a cancelled
// one — that's still real history) is never deletable; there's no
// equivalent of CarStatus to "retire" a client instead, so an admin who
// wants a problem client out of the way uses `notes` to flag them.
const CLIENT_HAS_HISTORY_MESSAGE =
  'Ce client a un historique de locations et ne peut pas être supprimé définitivement.';

async function hasHistory(clientId: string): Promise<boolean> {
  const relations = await ClientsRepository.countRelations(clientId);
  return relations.rentals > 0;
}

async function assertNoHistory(clientId: string): Promise<void> {
  if (await hasHistory(clientId)) {
    throw new AppError(409, 'CLIENT_HAS_HISTORY', CLIENT_HAS_HISTORY_MESSAGE);
  }
}

function formatCsvDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '';
}

export const ClientsService = {
  async list(query: ClientListQuery) {
    const { items, total } = await ClientsRepository.findMany(query);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(id: string) {
    const client = await ClientsRepository.findById(id);
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

  // Non-mutating precheck so the frontend's delete confirmation dialog can
  // show the right content (destructive confirm vs. explanatory notice)
  // before the admin ever clicks the button — same pattern as
  // CarsService.checkDeletable.
  async checkDeletable(id: string) {
    await ClientsService.getById(id);
    const blocked = await hasHistory(id);
    return { canDelete: !blocked, reason: blocked ? CLIENT_HAS_HISTORY_MESSAGE : null };
  },

  async delete(id: string, userId: string, ipAddress?: string) {
    const client = await ClientsService.getById(id);
    await assertNoHistory(id);

    try {
      await prisma.$transaction(async (tx) => {
        await ClientsRepository.deleteAllDocuments(id, tx);
        await ClientsRepository.deleteById(id, tx);
        await AuditService.record(tx, {
          userId,
          action: 'CLIENT_HARD_DELETE',
          entityType: 'Client',
          entityId: id,
          before: client,
          ipAddress,
        });
      });
    } catch (err) {
      toHasHistoryError(err);
    }

    // Same best-effort-after-commit pattern as CarsService.delete: a
    // leftover Cloudinary asset is a harmless cost, and the DB rows are
    // already gone either way by this point.
    for (const document of client.documents) {
      try {
        await deleteCloudinaryImage(document.publicId);
      } catch (err) {
        console.error(`Failed to delete Cloudinary asset ${document.publicId}:`, err);
      }
    }

    return client;
  },

  async addDocument(
    clientId: string,
    file: { buffer: Buffer },
    type: ClientDocumentType,
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
        { type, url: uploaded.url, publicId: uploaded.publicId },
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

  async getStats(id: string) {
    await ClientsService.getById(id);
    return ClientsRepository.getStats(id);
  },

  // Non-blocking — the form dialog shows this as a warning, never a hard
  // stop, since two clients (e.g. family members) can legitimately share a
  // phone number. See client-form-dialog.tsx.
  async checkPhoneDuplicate(phone: string, excludeId?: string) {
    const matches = await ClientsRepository.findByPhone(phone, excludeId);
    return matches;
  },

  async exportCsv(query: ClientExportQuery): Promise<string> {
    const clients = await ClientsRepository.findAllForExport(query);
    return toCsv<Client>(clients, [
      { header: 'Nom', value: (c) => c.lastName },
      { header: 'Prénom', value: (c) => c.firstName },
      { header: 'Téléphone', value: (c) => c.phone },
      { header: 'Email', value: (c) => c.email ?? '' },
      { header: 'Nationalité', value: (c) => c.nationality ?? '' },
      { header: 'Adresse', value: (c) => c.address ?? '' },
      { header: 'Ville', value: (c) => c.city ?? '' },
      { header: 'N° CIN', value: (c) => c.nationalIdNumber ?? '' },
      { header: 'N° Permis', value: (c) => c.drivingLicenseNumber },
      { header: 'Expiration permis', value: (c) => formatCsvDate(c.drivingLicenseExpiry) },
      { header: 'Date de naissance', value: (c) => formatCsvDate(c.dateOfBirth) },
      { header: 'Notes', value: (c) => c.notes ?? '' },
    ]);
  },

  async exportXlsx(query: ClientExportQuery): Promise<Buffer> {
    const clients = await ClientsRepository.findAllForExport(query);
    return toXlsxBuffer<Client>('Clients', clients, [
      { header: 'Nom', value: (c) => c.lastName, width: 16 },
      { header: 'Prénom', value: (c) => c.firstName, width: 16 },
      { header: 'Téléphone', value: (c) => c.phone, width: 16 },
      { header: 'Email', value: (c) => c.email, width: 24 },
      { header: 'Nationalité', value: (c) => c.nationality, width: 16 },
      { header: 'Adresse', value: (c) => c.address, width: 24 },
      { header: 'Ville', value: (c) => c.city, width: 16 },
      { header: 'N° CIN', value: (c) => c.nationalIdNumber, width: 16 },
      { header: 'N° Permis', value: (c) => c.drivingLicenseNumber, width: 16 },
      { header: 'Expiration permis', value: (c) => c.drivingLicenseExpiry, width: 16 },
      { header: 'Date de naissance', value: (c) => c.dateOfBirth, width: 16 },
      { header: 'Notes', value: (c) => c.notes, width: 30 },
    ]);
  },
};
