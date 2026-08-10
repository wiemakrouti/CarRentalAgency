import type { PaymentStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma-client.js';
import { archive, notDeleted, restore } from './soft-delete.js';
import type { PaymentListQuery } from '../validators/finance.validator.js';

type Db = PrismaClient | Prisma.TransactionClient;

// Default include: attachments only. Rentals' own list/detail responses
// nest Payment[] under a Rental that already has `car`/`client` at the top
// level, so repeating them per-payment there would just be duplicate payload.
const PAYMENT_INCLUDE = { attachments: true } as const;

// Finances' own list needs "which rental/car/client does this belong to"
// since it shows payments across every rental, not nested under one.
const PAYMENT_LIST_INCLUDE = {
  ...PAYMENT_INCLUDE,
  rental: { include: { car: true, client: true } },
} as const;

function buildWhere(query: PaymentListQuery): Prisma.PaymentWhereInput {
  const where = notDeleted<Prisma.PaymentWhereInput>(
    {
      rentalId: query.rentalId,
      type: query.type,
      status: query.status,
      method: query.method,
    },
    { includeArchived: query.includeArchived },
  );

  if (query.search) {
    where.OR = [
      { rental: { rentalNumber: { contains: query.search, mode: 'insensitive' } } },
      { rental: { client: { firstName: { contains: query.search, mode: 'insensitive' } } } },
      { rental: { client: { lastName: { contains: query.search, mode: 'insensitive' } } } },
    ];
  }

  return where;
}

export const PaymentsRepository = {
  // Used both by the Rentals lifecycle (Phase 4b's auto-generated
  // LATE_FEE/EXTENSION_PAYMENT/DAMAGE_FEE rows) and by Finances' manual
  // payment entry (Phase 5).
  create(data: Prisma.PaymentUncheckedCreateInput, db: Db = prisma) {
    return db.payment.create({ data, include: PAYMENT_INCLUDE });
  },

  async findMany(query: PaymentListQuery, db: Db = prisma) {
    const where = buildWhere(query);
    const [items, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: PAYMENT_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.payment.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string, options?: { includeArchived?: boolean }, db: Db = prisma) {
    return db.payment.findFirst({
      where: notDeleted({ id }, options),
      include: PAYMENT_LIST_INCLUDE,
    });
  },

  update(id: string, data: Prisma.PaymentUncheckedUpdateInput, db: Db = prisma) {
    return db.payment.update({ where: { id }, data, include: PAYMENT_INCLUDE });
  },

  archiveById(id: string, db: Db = prisma) {
    return db.payment.update({ where: { id }, data: archive(), include: PAYMENT_INCLUDE });
  },

  restoreById(id: string, db: Db = prisma) {
    return db.payment.update({ where: { id }, data: restore(), include: PAYMENT_INCLUDE });
  },

  addAttachment(paymentId: string, data: { url: string; publicId: string }, db: Db = prisma) {
    return db.paymentAttachment.create({ data: { paymentId, ...data } });
  },

  findAttachmentById(attachmentId: string, db: Db = prisma) {
    return db.paymentAttachment.findUnique({ where: { id: attachmentId } });
  },

  deleteAttachmentById(attachmentId: string, db: Db = prisma) {
    return db.paymentAttachment.delete({ where: { id: attachmentId } });
  },

  // Aggregates for GET /finances/summary. Bounded by `createdAt` (when the
  // payment was recorded), not `paidAt` (nullable — a PENDING row has none)
  // so the same date filter works uniformly across every status.
  sumByTypeForStatus(status: PaymentStatus, range: { from: Date; to: Date }, db: Db = prisma) {
    return db.payment.groupBy({
      by: ['type'],
      where: notDeleted({ status, createdAt: { gte: range.from, lte: range.to } }),
      _sum: { amount: true },
    });
  },

  async sumForStatus(status: PaymentStatus, range: { from: Date; to: Date }, db: Db = prisma) {
    const result = await db.payment.aggregate({
      where: notDeleted({ status, createdAt: { gte: range.from, lte: range.to } }),
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  },
};
