import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma-client.js';

type Db = PrismaClient | Prisma.TransactionClient;

export const RentalExtensionsRepository = {
  create(data: Prisma.RentalExtensionUncheckedCreateInput, db: Db = prisma) {
    return db.rentalExtension.create({ data });
  },
};
