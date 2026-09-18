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

  // Powers "Déconnecter les autres appareils" — every active session except
  // the one presenting `exceptTokenHash` (the browser tab the admin is
  // sitting in right now).
  revokeAllActiveForUserExcept(userId: string, exceptTokenHash: string, db: Db = prisma) {
    return db.refreshToken.updateMany({
      where: { userId, revokedAt: null, tokenHash: { not: exceptTokenHash } },
      data: { revokedAt: new Date() },
    });
  },

  findById(id: string, db: Db = prisma) {
    return db.refreshToken.findUnique({ where: { id } });
  },

  // The Profil page's session list — active (not revoked, not yet expired)
  // sessions only; a revoked or expired row is history, not something the
  // admin can act on, so it's filtered out here rather than in the UI.
  findActiveByUser(userId: string, db: Db = prisma) {
    return db.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
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
