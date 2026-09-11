import type { PaymentStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma-client.js';
import { archive, notDeleted, restore } from './soft-delete.js';
import type { DepositListQuery, PaymentListQuery } from '../validators/finance.validator.js';

type Db = PrismaClient | Prisma.TransactionClient;

// `from`/`to` are UTC midnight of a calendar day (z.coerce.date() of a
// YYYY-MM-DD query param) — but `createdAt` is a real timestamp, so a plain
// `lte: to` would exclude almost all of that day's payments (anything
// created after 00:00 UTC). Compare against the exclusive start of the next
// day instead, so the whole "to" day is actually covered — same
// gte-this-day/lt-next-day pattern as RemindersService's date-range queries.
function endOfDayExclusive(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

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

  // Bounded by `createdAt` (when the payment was recorded), same convention
  // as sumByTypeForStatus below — not `paidAt`, which is null for a PENDING
  // row and would silently drop it from a date-filtered list.
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lt: endOfDayExclusive(query.to) } : {}),
    };
  }

  return where;
}

// Shared by findDepositsPage/countDeposits below. Filters at the Payment
// grain (one DEPOSIT row) rather than the Rental grain — `status` reaches
// through the relation since OUTSTANDING/REFUNDED is really
// Rental.depositReturned, not a Payment column. Bounded by `paidAt` (when
// the deposit was actually collected), not `createdAt` — unlike buildWhere
// above, a caution's real-world "collected on" date is what a from/to filter
// here should mean.
function buildDepositWhere(query: DepositListQuery): Prisma.PaymentWhereInput {
  const where = notDeleted<Prisma.PaymentWhereInput>({
    type: 'DEPOSIT',
    status: 'COMPLETED',
    ...(query.status === 'OUTSTANDING' ? { rental: { depositReturned: false } } : {}),
    ...(query.status === 'REFUNDED' ? { rental: { depositReturned: true } } : {}),
  });

  if (query.search) {
    where.OR = [
      { rental: { rentalNumber: { contains: query.search, mode: 'insensitive' } } },
      { rental: { client: { firstName: { contains: query.search, mode: 'insensitive' } } } },
      { rental: { client: { lastName: { contains: query.search, mode: 'insensitive' } } } },
      { rental: { car: { brand: { contains: query.search, mode: 'insensitive' } } } },
      { rental: { car: { model: { contains: query.search, mode: 'insensitive' } } } },
    ];
  }

  if (query.from || query.to) {
    where.paidAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lt: endOfDayExclusive(query.to) } : {}),
    };
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
  // so the same date filter works uniformly across every status. `to` needs
  // the same exclusive-next-day treatment as buildWhere above, or a summary
  // for "this month" would drop nearly all of today's payments.
  sumByTypeForStatus(status: PaymentStatus, range: { from: Date; to: Date }, db: Db = prisma) {
    return db.payment.groupBy({
      by: ['type'],
      where: notDeleted({ status, createdAt: { gte: range.from, lt: endOfDayExclusive(range.to) } }),
      _sum: { amount: true },
    });
  },

  // "Cautions" tab: a page of the full ledger — every collected caution,
  // whether still sitting with the client or already refunded — not bounded
  // by any date range unless the caller filters one: this is a standing
  // ledger, not a period report (a caution collected months ago still
  // belongs here). Oldest first: the longest-standing deposit is the most
  // worth reviewing first, refunded or not.
  //
  // Paginates at the Payment grain, not the (displayed) one-row-per-rental
  // grain the service groups these into — the rare rental with more than one
  // COMPLETED DEPOSIT row (e.g. a corrected amount) could in principle have
  // its two rows split across two pages. Accepted trade-off: querying at the
  // Rental grain instead would lose the real `paidAt` ordering/filtering
  // this is built on, for a correction scenario rare enough not to matter in
  // practice.
  async findDepositsPage(query: DepositListQuery, db: Db = prisma) {
    const where = buildDepositWhere(query);
    const [items, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: PAYMENT_LIST_INCLUDE,
        orderBy: { paidAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.payment.count({ where }),
    ]);
    return { items, total };
  },

  // Paired with findDepositsPage to resolve each rental's refund date, if
  // any. DEPOSIT and DEPOSIT_REFUND are two independent Payment rows —
  // Prisma has no direct relation between them, only a shared rentalId (see
  // PaymentsService.create's DEPOSIT_REFUND ↔ depositReturned sync) — so
  // this is a second query rather than a nested include.
  findDepositRefunds(rentalIds: string[], db: Db = prisma) {
    return db.payment.findMany({
      where: notDeleted<Prisma.PaymentWhereInput>({
        type: 'DEPOSIT_REFUND',
        status: 'COMPLETED',
        rentalId: { in: rentalIds },
      }),
      select: { rentalId: true, paidAt: true },
    });
  },

  // Résumé's "Cautions" card: the all-time totals of every caution ever
  // collected and every one ever refunded. Not scoped to any date range —
  // the card deliberately ignores the Résumé tab's filter, so this reads
  // the whole history. "Encore retenus" is just collected − refunded.
  async sumDepositFlows(db: Db = prisma) {
    const rows = await db.payment.groupBy({
      by: ['type'],
      where: notDeleted<Prisma.PaymentWhereInput>({
        type: { in: ['DEPOSIT', 'DEPOSIT_REFUND'] },
        status: 'COMPLETED',
      }),
      _sum: { amount: true },
    });
    const sumFor = (type: string) => Number(rows.find((row) => row.type === type)?._sum.amount ?? 0);
    return { collected: sumFor('DEPOSIT'), refunded: sumFor('DEPOSIT_REFUND') };
  },
};
