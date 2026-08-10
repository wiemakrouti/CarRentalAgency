import type { Prisma, PrismaClient, RentalStatus } from '@prisma/client';
import { prisma } from '../lib/prisma-client.js';
import { notDeleted } from './soft-delete.js';
import { overlappingRentalsFilter } from '../lib/rental-availability.js';
import type { RentalListQuery } from '../validators/rental.validator.js';

type Db = PrismaClient | Prisma.TransactionClient;

// payments.attachments (Phase 5): damage-fee photos are most useful right
// where the damage was recorded — a rental's own detail view — not just in
// the standalone Finances payments list.
const RENTAL_INCLUDE = {
  car: true,
  client: true,
  extensions: true,
  payments: { include: { attachments: true } },
} as const;

function buildWhere(query: RentalListQuery): Prisma.RentalWhereInput {
  const where = notDeleted<Prisma.RentalWhereInput>(
    {
      status: query.status,
      carId: query.carId,
      clientId: query.clientId,
    },
    { includeArchived: query.includeArchived },
  );

  if (query.search) {
    where.OR = [
      { rentalNumber: { contains: query.search, mode: 'insensitive' } },
      { car: { brand: { contains: query.search, mode: 'insensitive' } } },
      { car: { model: { contains: query.search, mode: 'insensitive' } } },
      { car: { licensePlate: { contains: query.search, mode: 'insensitive' } } },
      { client: { firstName: { contains: query.search, mode: 'insensitive' } } },
      { client: { lastName: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  return where;
}

export const RentalsRepository = {
  async findMany(query: RentalListQuery, db: Db = prisma) {
    const where = buildWhere(query);
    const [items, total] = await Promise.all([
      db.rental.findMany({
        where,
        include: RENTAL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.rental.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string, options?: { includeArchived?: boolean }, db: Db = prisma) {
    return db.rental.findFirst({
      where: notDeleted({ id }, options),
      include: RENTAL_INCLUDE,
    });
  },

  hasOverlap(
    carId: string,
    params: { pickupDate: Date; returnDate: Date; excludeRentalId?: string },
    db: Db = prisma,
  ) {
    return db.rental.findFirst({
      where: { carId, ...overlappingRentalsFilter(params) },
    });
  },

  create(data: Prisma.RentalUncheckedCreateInput, db: Db = prisma) {
    return db.rental.create({ data, include: RENTAL_INCLUDE });
  },

  // Atomic guard against invalid-state transitions and races: the WHERE
  // clause re-checks status at the DB row level, so two concurrent requests
  // racing on the same rental can never both succeed. Caller must re-fetch
  // via findById if it needs the updated record.
  async updateGuarded(
    id: string,
    expectedStatuses: readonly RentalStatus[],
    data: Prisma.RentalUncheckedUpdateManyInput,
    db: Db = prisma,
  ): Promise<boolean> {
    const result = await db.rental.updateMany({
      where: { id, status: { in: [...expectedStatuses] }, deletedAt: null },
      data,
    });
    return result.count === 1;
  },

  // Not status-guarded like the lifecycle transitions above: a deposit can
  // legitimately be handed back at any point after it was collected, so
  // there's no single expected Rental.status to check against. Called from
  // PaymentsService.create inside the same transaction as the
  // DEPOSIT_REFUND payment row (Phase 5 business rule).
  markDepositReturned(id: string, db: Db = prisma) {
    return db.rental.update({ where: { id }, data: { depositReturned: true } });
  },
};
