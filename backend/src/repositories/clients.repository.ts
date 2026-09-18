import type { Prisma, PrismaClient } from '@prisma/client';
import {
  REVENUE_PAYMENT_TYPES,
  type ClientDocumentType,
  type CreateClientInput,
  type UpdateClientInput,
} from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { endOfDayExclusive } from '../lib/date-utils.js';
import type { ClientExportQuery, ClientListQuery } from '../validators/client.validator.js';

type Db = PrismaClient | Prisma.TransactionClient;

// The filter/sort fields shared by the paginated list and the unpaginated
// export — ClientListQuery adds page/pageSize on top, which neither function
// below reads (mirrors CarFilterQuery in cars.repository.ts).
type ClientFilterQuery = ClientExportQuery;

// Same 30-day window as the frontend's client-alerts.ts getLicenseAlertLevel
// — kept in sync manually since one is a Prisma date-range filter and the
// other a display computation, not worth sharing across the API boundary.
const LICENSE_EXPIRY_WARNING_DAYS = 30;

function buildWhere(agencyId: string, query: ClientFilterQuery): Prisma.ClientWhereInput {
  const where: Prisma.ClientWhereInput = { agencyId };

  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { drivingLicenseNumber: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.city) {
    where.city = { contains: query.city, mode: 'insensitive' };
  }

  // createdAt is a real timestamp, not a date-only field like
  // drivingLicenseExpiry below — endOfDayExclusive keeps the whole
  // `createdTo` calendar day covered instead of cutting it off at 00:00 UTC.
  if (query.createdFrom || query.createdTo) {
    where.createdAt = {
      ...(query.createdFrom ? { gte: query.createdFrom } : {}),
      ...(query.createdTo ? { lt: endOfDayExclusive(query.createdTo) } : {}),
    };
  }

  if (query.licenseStatus) {
    // UTC midnight, not server-local — drivingLicenseExpiry is stored as UTC
    // midnight (see client-form-dialog.tsx's dateToInputValue) and
    // RemindersService/client-alerts.ts's badge both key off UTC-midnight-
    // of-today; a server-local cutoff would silently disagree with both
    // depending on the deployment's timezone.
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const warningCutoff = new Date(today);
    warningCutoff.setUTCDate(warningCutoff.getUTCDate() + LICENSE_EXPIRY_WARNING_DAYS);

    switch (query.licenseStatus) {
      case 'not_set':
        where.drivingLicenseExpiry = null;
        break;
      case 'expired':
        where.drivingLicenseExpiry = { lt: today };
        break;
      case 'expiring':
        where.drivingLicenseExpiry = { gte: today, lte: warningCutoff };
        break;
      case 'ok':
        where.drivingLicenseExpiry = { gt: warningCutoff };
        break;
    }
  }

  return where;
}

function buildOrderBy(query: ClientFilterQuery): Prisma.ClientOrderByWithRelationInput {
  return { [query.sortBy]: query.sortOrder };
}

// Attaches each client's reliability rate and its underlying counts (share
// of resolved rentals — COMPLETED + CANCELLED — that were actually honored,
// same definition as getStats' resolvedCount/completedRentalsCount) with a
// single grouped query for the whole page, instead of re-running getStats
// per row — that would be an N+1 (4 queries × pageSize) just to render the
// list. completedRentals/cancelledRentals are exposed alongside the rate so
// the table's tooltip can read "2 annulées sur 8" instead of a bare percent.
async function attachReliabilityRates<T extends { id: string }>(
  clients: T[],
  db: Db,
): Promise<
  (T & { reliabilityRate: number | null; completedRentals: number; cancelledRentals: number })[]
> {
  if (clients.length === 0) return [];

  const counts = await db.rental.groupBy({
    by: ['clientId', 'status'],
    where: {
      clientId: { in: clients.map((c) => c.id) },
      deletedAt: null,
      status: { in: ['COMPLETED', 'CANCELLED'] },
    },
    _count: { _all: true },
  });

  const byClient = new Map<string, { completed: number; cancelled: number }>();
  for (const row of counts) {
    const entry = byClient.get(row.clientId) ?? { completed: 0, cancelled: 0 };
    if (row.status === 'COMPLETED') entry.completed += row._count._all;
    else entry.cancelled += row._count._all;
    byClient.set(row.clientId, entry);
  }

  return clients.map((client) => {
    const entry = byClient.get(client.id) ?? { completed: 0, cancelled: 0 };
    const resolved = entry.completed + entry.cancelled;
    return {
      ...client,
      reliabilityRate: resolved > 0 ? entry.completed / resolved : null,
      completedRentals: entry.completed,
      cancelledRentals: entry.cancelled,
    };
  });
}

export const ClientsRepository = {
  async findMany(agencyId: string, query: ClientListQuery, db: Db = prisma) {
    const where = buildWhere(agencyId, query);
    const [items, total] = await Promise.all([
      db.client.findMany({
        where,
        include: { documents: true },
        orderBy: buildOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.client.count({ where }),
    ]);
    return { items: await attachReliabilityRates(items, db), total };
  },

  findAllForExport(agencyId: string, query: ClientExportQuery, db: Db = prisma) {
    return db.client.findMany({ where: buildWhere(agencyId, query), orderBy: buildOrderBy(query) });
  },

  findById(agencyId: string, id: string, db: Db = prisma) {
    return db.client.findFirst({
      where: { id, agencyId },
      include: { documents: true },
    });
  },

  // Non-blocking duplicate-phone check (see ClientsService.checkPhoneDuplicate)
  // — exact match on the stored string, same as the email uniqueness
  // constraint, no digit normalization in this v1.
  findByPhone(agencyId: string, phone: string, excludeId: string | undefined, db: Db = prisma) {
    return db.client.findMany({
      where: { agencyId, phone, id: excludeId ? { not: excludeId } : undefined },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
  },

  create(agencyId: string, data: CreateClientInput, db: Db = prisma) {
    return db.client.create({ data: { ...data, agencyId }, include: { documents: true } });
  },

  update(id: string, data: UpdateClientInput, db: Db = prisma) {
    return db.client.update({ where: { id }, data, include: { documents: true } });
  },

  // Client has no soft-delete (see docs/architecture.md § Soft delete) — a
  // client is either in the system or permanently gone, guarded by
  // countRelations below. deleteAllDocuments mirrors CarsRepository.
  // deleteAllImages: DB rows go first inside the transaction, Cloudinary
  // cleanup happens best-effort afterward in the service.
  async countRelations(clientId: string, db: Db = prisma) {
    const rentals = await db.rental.count({ where: { clientId } });
    return { rentals };
  },

  deleteAllDocuments(clientId: string, db: Db = prisma) {
    return db.clientDocument.deleteMany({ where: { clientId } });
  },

  deleteById(id: string, db: Db = prisma) {
    return db.client.delete({ where: { id } });
  },

  addDocument(
    clientId: string,
    data: { type: ClientDocumentType; url: string; publicId: string },
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

  // Powers the client profile panel: rental counts, revenue actually
  // collected (COMPLETED payments, not just contracted totalAmount — mirrors
  // CarsRepository.getStats' definition of "revenue"), the most recent
  // pickup, how many completed rentals were returned on time, and how many
  // of this client's resolved reservations were actually honored rather
  // than cancelled.
  async getStats(clientId: string, db: Db = prisma) {
    const [rentalCounts, revenue, lastRental, completedRentals] = await Promise.all([
      db.rental.groupBy({
        by: ['status'],
        where: { clientId, deletedAt: null },
        _count: { _all: true },
      }),
      // type filter excludes DEPOSIT/DEPOSIT_REFUND — a caution is a
      // refundable hold, not revenue (same REVENUE_PAYMENT_TYPES
      // FinanceSummaryService uses); left in, collecting then fully
      // refunding one would inflate this client's "revenue" by 2x its amount.
      db.payment.aggregate({
        where: {
          status: 'COMPLETED',
          deletedAt: null,
          rental: { clientId },
          type: { in: [...REVENUE_PAYMENT_TYPES] },
        },
        _sum: { amount: true },
      }),
      db.rental.findFirst({
        where: { clientId, deletedAt: null },
        orderBy: { pickupDate: 'desc' },
        select: { pickupDate: true },
      }),
      db.rental.findMany({
        where: { clientId, deletedAt: null, status: 'COMPLETED' },
        select: { actualReturnDate: true, plannedReturnDate: true },
      }),
    ]);

    const onTimeCount = completedRentals.filter(
      (r) => r.actualReturnDate && r.actualReturnDate <= r.plannedReturnDate,
    ).length;

    const completedRentalsCount =
      rentalCounts.find((r) => r.status === 'COMPLETED')?._count._all ?? 0;
    const cancelledRentalsCount =
      rentalCounts.find((r) => r.status === 'CANCELLED')?._count._all ?? 0;
    // Only counts rentals with a known outcome — a still-RESERVED or ACTIVE
    // one hasn't been honored or cancelled yet, so it's excluded from both
    // sides rather than silently counted as "honored" by omission.
    const resolvedCount = completedRentalsCount + cancelledRentalsCount;

    return {
      totalRentals: rentalCounts.reduce((sum, r) => sum + r._count._all, 0),
      completedRentals: completedRentalsCount,
      cancelledRentals: cancelledRentalsCount,
      totalRevenue: Number(revenue._sum.amount ?? 0),
      lastRentalDate: lastRental?.pickupDate ?? null,
      onTimeReturnRate: completedRentals.length > 0 ? onTimeCount / completedRentals.length : null,
      reliabilityRate: resolvedCount > 0 ? completedRentalsCount / resolvedCount : null,
    };
  },
};
