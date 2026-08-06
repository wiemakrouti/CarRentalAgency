import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma-client.js';

type Db = PrismaClient | Prisma.TransactionClient;

interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export const RefreshTokenRepository = {
  create(data: CreateRefreshTokenInput, db: Db = prisma) {
    return db.refreshToken.create({ data });
  },

  findByTokenHash(tokenHash: string, db: Db = prisma) {
    return db.refreshToken.findUnique({ where: { tokenHash } });
  },

  revoke(id: string, replacedByTokenId: string | undefined, db: Db = prisma) {
    return db.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedByTokenId },
    });
  },

  revokeAllActiveForUser(userId: string, db: Db = prisma) {
    return db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  deleteById(id: string, db: Db = prisma) {
    return db.refreshToken.delete({ where: { id } });
  },

  // Not wired to a scheduler yet (see docs/database.md "Authentication") —
  // exists so the future cleanup job has a ready-made query to call.
  deleteExpired(db: Db = prisma) {
    return db.refreshToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }] },
    });
  },
};
