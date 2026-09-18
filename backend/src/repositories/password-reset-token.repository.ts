import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma-client.js';

type Db = PrismaClient | Prisma.TransactionClient;

export const PasswordResetTokenRepository = {
  create(data: { userId: string; tokenHash: string; expiresAt: Date }, db: Db = prisma) {
    return db.passwordResetToken.create({ data });
  },

  findByTokenHash(tokenHash: string, db: Db = prisma) {
    return db.passwordResetToken.findUnique({ where: { tokenHash } });
  },

  // Called before issuing a new token (each forgot-password request) so at
  // most one reset link is ever valid for a given user at a time.
  deleteAllForUser(userId: string, db: Db = prisma) {
    return db.passwordResetToken.deleteMany({ where: { userId } });
  },
};
