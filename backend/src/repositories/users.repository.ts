import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma-client.js';

type Db = PrismaClient | Prisma.TransactionClient;

export const UsersRepository = {
  findByEmail(email: string, db: Db = prisma) {
    return db.user.findUnique({ where: { email } });
  },

  findById(id: string, db: Db = prisma) {
    return db.user.findUnique({ where: { id } });
  },

  updateLastLogin(id: string, db: Db = prisma) {
    return db.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  },
};
