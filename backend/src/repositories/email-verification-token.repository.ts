import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma-client.js';

type Db = PrismaClient | Prisma.TransactionClient;

export const EmailVerificationTokenRepository = {
  create(data: { userId: string; tokenHash: string; expiresAt: Date }, db: Db = prisma) {
    return db.emailVerificationToken.create({ data });
  },

  findByTokenHash(tokenHash: string, db: Db = prisma) {
    return db.emailVerificationToken.findUnique({ where: { tokenHash } });
  },

  // Called before issuing a new token (registration's own create, or a
  // resend) so at most one token is ever valid for a given user at a time.
  deleteAllForUser(userId: string, db: Db = prisma) {
    return db.emailVerificationToken.deleteMany({ where: { userId } });
  },
};
