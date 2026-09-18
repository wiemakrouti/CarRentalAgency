import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma-client.js';

type Db = PrismaClient | Prisma.TransactionClient;

// One row per agency (see AuthService.register) — `get()` takes the caller's
// agencyId, never a raw id, so a request can never read another agency's
// Setting row by guessing/reusing one.
export const SettingsRepository = {
  get(agencyId: string, db: Db = prisma) {
    return db.setting.findFirst({ where: { agencyId } });
  },

  update(id: string, data: Prisma.SettingUpdateInput, db: Db = prisma) {
    return db.setting.update({ where: { id }, data });
  },
};
