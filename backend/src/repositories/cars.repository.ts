import type { CarStatus, Prisma, PrismaClient } from '@prisma/client';
import type { CreateCarInput, UpdateCarInput } from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { archive, notDeleted, restore } from './soft-delete.js';
import { overlappingRentalsFilter } from '../lib/rental-availability.js';
import type { CarExportQuery, CarListQuery } from '../validators/car.validator.js';

type Db = PrismaClient | Prisma.TransactionClient;

// The filter/sort fields shared by the paginated list and the unpaginated
// export — CarListQuery adds page/pageSize on top, which neither function
// below reads.
type CarFilterQuery = CarExportQuery;

function buildWhere(query: CarFilterQuery): Prisma.CarWhereInput {
  const where = notDeleted<Prisma.CarWhereInput>(
    {
      category: query.category,
      status: query.status,
      transmission: query.transmission,
      fuelType: query.fuelType,
    },
    { includeArchived: query.includeArchived },
  );

  if (query.search) {
    where.OR = [
      { brand: { contains: query.search, mode: 'insensitive' } },
      { model: { contains: query.search, mode: 'insensitive' } },
      { licensePlate: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.minDailyRate !== undefined || query.maxDailyRate !== undefined) {
    where.dailyRate = { gte: query.minDailyRate, lte: query.maxDailyRate };
  }
  if (query.minYear !== undefined || query.maxYear !== undefined) {
    where.year = { gte: query.minYear, lte: query.maxYear };
  }
  if (query.minMileage !== undefined || query.maxMileage !== undefined) {
    where.mileage = { gte: query.minMileage, lte: query.maxMileage };
  }

  return where;
}

function buildOrderBy(query: CarFilterQuery): Prisma.CarOrderByWithRelationInput {
  return { [query.sortBy]: query.sortOrder };
}

// A car's status is only ever RENTED while exactly one of its rentals is
// ACTIVE or OVERDUE (see RentalsService.activate/return) — this include
// fetches that one rental's plannedReturnDate so the UI can show "back on
// [date]" instead of a bare status badge.
const ACTIVE_RENTAL_INCLUDE = {
  rentals: {
    where: { status: { in: ['ACTIVE', 'OVERDUE'] as const } },
    select: { plannedReturnDate: true },
    take: 1,
  },
} satisfies Prisma.CarInclude;

function withActiveRental<T extends { rentals: { plannedReturnDate: Date }[] }>(car: T) {
  const { rentals, ...rest } = car;
  return { ...rest, activeRental: rentals[0] ?? null };
}

export const CarsRepository = {
  async findMany(query: CarListQuery, db: Db = prisma) {
    const where = buildWhere(query);
    const [items, total] = await Promise.all([
      db.car.findMany({
        where,
        include: { images: true, ...ACTIVE_RENTAL_INCLUDE },
        orderBy: buildOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.car.count({ where }),
    ]);
    return { items: items.map(withActiveRental), total };
  },

  async findById(id: string, options?: { includeArchived?: boolean }, db: Db = prisma) {
    const car = await db.car.findFirst({
      where: notDeleted({ id }, options),
      include: { images: true, ...ACTIVE_RENTAL_INCLUDE },
    });
    return car ? withActiveRental(car) : null;
  },

  create(data: CreateCarInput, db: Db = prisma) {
    return db.car.create({ data, include: { images: true } });
  },

  update(id: string, data: UpdateCarInput, db: Db = prisma) {
    return db.car.update({ where: { id }, data, include: { images: true } });
  },

  // Same atomic status-guard pattern as RentalsRepository.updateGuarded —
  // used by the rental lifecycle to prevent activating/returning a car that
  // changed status underneath a concurrent request.
  async updateStatusGuarded(
    id: string,
    expectedStatuses: readonly CarStatus[],
    data: Prisma.CarUncheckedUpdateManyInput,
    db: Db = prisma,
  ): Promise<boolean> {
    const result = await db.car.updateMany({
      where: { id, status: { in: [...expectedStatuses] }, deletedAt: null },
      data,
    });
    return result.count === 1;
  },

  archiveById(id: string, db: Db = prisma) {
    return db.car.update({ where: { id }, data: archive(), include: { images: true } });
  },

  restoreById(id: string, db: Db = prisma) {
    return db.car.update({ where: { id }, data: restore(), include: { images: true } });
  },

  addImage(
    carId: string,
    data: { url: string; publicId: string; isPrimary: boolean },
    db: Db = prisma,
  ) {
    return db.carImage.create({ data: { carId, ...data } });
  },

  findImageById(imageId: string, db: Db = prisma) {
    return db.carImage.findUnique({ where: { id: imageId } });
  },

  unsetPrimaryImages(carId: string, db: Db = prisma) {
    return db.carImage.updateMany({
      where: { carId, isPrimary: true },
      data: { isPrimary: false },
    });
  },

  setImagePrimary(imageId: string, db: Db = prisma) {
    return db.carImage.update({ where: { id: imageId }, data: { isPrimary: true } });
  },

  deleteImageById(imageId: string, db: Db = prisma) {
    return db.carImage.delete({ where: { id: imageId } });
  },

  findAllForExport(query: CarExportQuery, db: Db = prisma) {
    return db.car.findMany({ where: buildWhere(query), orderBy: buildOrderBy(query) });
  },

  // Powers the Cars detail panel: rental counts by status, revenue actually
  // collected for this car (COMPLETED payments, not just contracted
  // totalAmount — mirrors FinanceSummaryService's definition of "revenue"),
  // and the most recent pickup.
  async getStats(carId: string, db: Db = prisma) {
    const [rentalCounts, revenue, lastRental] = await Promise.all([
      db.rental.groupBy({
        by: ['status'],
        where: { carId, deletedAt: null },
        _count: { _all: true },
      }),
      db.payment.aggregate({
        where: { status: 'COMPLETED', deletedAt: null, rental: { carId } },
        _sum: { amount: true },
      }),
      db.rental.findFirst({
        where: { carId, deletedAt: null },
        orderBy: { pickupDate: 'desc' },
        select: { pickupDate: true },
      }),
    ]);

    return {
      totalRentals: rentalCounts.reduce((sum, r) => sum + r._count._all, 0),
      completedRentals: rentalCounts.find((r) => r.status === 'COMPLETED')?._count._all ?? 0,
      totalRevenue: Number(revenue._sum.amount ?? 0),
      lastRentalDate: lastRental?.pickupDate ?? null,
    };
  },

  findAvailable(params: { pickupDate: Date; returnDate: Date }, db: Db = prisma) {
    const availabilityFilter: Prisma.CarWhereInput = {
      status: 'AVAILABLE',
      rentals: { none: overlappingRentalsFilter(params) },
    };

    return db.car.findMany({
      where: notDeleted(availabilityFilter),
      include: { images: true },
      orderBy: { brand: 'asc' },
    });
  },
};
