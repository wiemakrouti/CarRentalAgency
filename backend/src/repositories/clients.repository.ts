import type { Prisma, PrismaClient } from '@prisma/client';
import type { ClientDocumentType, CreateClientInput, UpdateClientInput } from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { archive, notDeleted, restore } from './soft-delete.js';
import type { ClientListQuery } from '../validators/client.validator.js';

type Db = PrismaClient | Prisma.TransactionClient;

function buildWhere(query: ClientListQuery): Prisma.ClientWhereInput {
  const where = notDeleted<Prisma.ClientWhereInput>(
    { blacklisted: query.blacklisted },
    { includeArchived: query.includeArchived },
  );

  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { drivingLicenseNumber: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

export const ClientsRepository = {
  async findMany(query: ClientListQuery, db: Db = prisma) {
    const where = buildWhere(query);
    const [items, total] = await Promise.all([
      db.client.findMany({
        where,
        include: { documents: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.client.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string, options?: { includeArchived?: boolean }, db: Db = prisma) {
    return db.client.findFirst({
      where: notDeleted({ id }, options),
      include: { documents: true },
    });
  },

  create(data: CreateClientInput, db: Db = prisma) {
    return db.client.create({ data, include: { documents: true } });
  },

  update(id: string, data: UpdateClientInput, db: Db = prisma) {
    return db.client.update({ where: { id }, data, include: { documents: true } });
  },

  archiveById(id: string, db: Db = prisma) {
    return db.client.update({ where: { id }, data: archive(), include: { documents: true } });
  },

  restoreById(id: string, db: Db = prisma) {
    return db.client.update({ where: { id }, data: restore(), include: { documents: true } });
  },

  addDocument(
    clientId: string,
    data: { type: ClientDocumentType; url: string; publicId: string; expiryDate: Date | null },
    db: Db = prisma,
  ) {
    return db.clientDocument.create({ data: { clientId, ...data } });
  },

  findDocumentById(documentId: string, db: Db = prisma) {
    return db.clientDocument.findUnique({ where: { id: documentId } });
  },

  deleteDocumentById(documentId: string, db: Db = prisma) {
    return db.clientDocument.delete({ where: { id: documentId } });
  },
};
