import type { Prisma, PrismaClient } from '@prisma/client';
import type { CreateCarInput, UpdateCarInput } from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { archive, notDeleted, restore } from './soft-delete.js';
import type { CarListQuery } from '../validators/car.validator.js';

type Db = PrismaClient | Prisma.TransactionClient;

function buildWhere(query: CarListQuery): Prisma.CarWhereInput {
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

  return where;
}

export const CarsRepository = {
  async findMany(query: CarListQuery, db: Db = prisma) {
    const where = buildWhere(query);
    const [items, total] = await Promise.all([
      db.car.findMany({
        where,
        include: { images: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.car.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string, options?: { includeArchived?: boolean }, db: Db = prisma) {
    return db.car.findFirst({
      where: notDeleted({ id }, options),
      include: { images: true },
    });
  },

  create(data: CreateCarInput, db: Db = prisma) {
    return db.car.create({ data, include: { images: true } });
  },

  update(id: string, data: UpdateCarInput, db: Db = prisma) {
    return db.car.update({ where: { id }, data, include: { images: true } });
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
    return db.carImage.updateMany({ where: { carId, isPrimary: true }, data: { isPrimary: false } });
  },

  setImagePrimary(imageId: string, db: Db = prisma) {
    return db.carImage.update({ where: { id: imageId }, data: { isPrimary: true } });
  },

  deleteImageById(imageId: string, db: Db = prisma) {
    return db.carImage.delete({ where: { id: imageId } });
  },

  findAvailable(params: { pickupDate: Date; returnDate: Date }, db: Db = prisma) {
    const availabilityFilter: Prisma.CarWhereInput = {
      status: 'AVAILABLE',
      rentals: {
        none: {
          status: { in: ['RESERVED', 'ACTIVE'] },
          pickupDate: { lt: params.returnDate },
          plannedReturnDate: { gt: params.pickupDate },
        },
      },
    };

    return db.car.findMany({
      where: notDeleted(availabilityFilter),
      include: { images: true },
      orderBy: { brand: 'asc' },
    });
  },
};
