import type { Prisma, PrismaClient } from '@prisma/client';
import type { ActivityCategory, ActivityQuery } from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { endOfDayExclusive } from '../lib/date-utils.js';

type Db = PrismaClient | Prisma.TransactionClient;

// Sign-ins, password and session changes: their own "account" category, left
// out of the journal by default so the day-to-day work isn't buried under them.
const ACCOUNT_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'PASSWORD_CHANGE',
  'PASSWORD_RESET',
  'PROFILE_UPDATE',
  'EMAIL_VERIFY',
  'SESSION_REVOKE',
  'SESSIONS_REVOKE_OTHERS',
];

const CATEGORY_WHERE: Record<ActivityCategory, Prisma.AuditLogWhereInput> = {
  approvals: { entityType: 'ApprovalRequest' },
  rentals: { entityType: 'Rental' },
  payments: { entityType: 'Payment' },
  expenses: { entityType: 'Expense' },
  clients: { entityType: 'Client' },
  cars: { entityType: 'Car' },
  team: { action: { startsWith: 'USER_' } },
  settings: { entityType: 'Setting' },
  account: { OR: [{ action: { in: ACCOUNT_ACTIONS } }, { action: 'CREATE', entityType: 'User' }] },
};

const ACTOR_INCLUDE = { user: { select: { id: true, fullName: true, role: true } } } as const;

export const ActivityRepository = {
  async findPage(agencyId: string, query: ActivityQuery, db: Db = prisma) {
    const where: Prisma.AuditLogWhereInput = {
      agencyId,
      userId: query.userId,
      createdAt: {
        gte: query.from,
        lt: query.to ? endOfDayExclusive(query.to) : undefined,
      },
      ...(query.category ? CATEGORY_WHERE[query.category] : { NOT: CATEGORY_WHERE.account }),
    };
    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: ACTOR_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.auditLog.count({ where }),
    ]);
    return { items, total };
  },

};
