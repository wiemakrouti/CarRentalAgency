import type { Prisma, PrismaClient } from '@prisma/client';
import type { CreateExpenseInput, UpdateExpenseInput } from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { archive, notDeleted, restore } from './soft-delete.js';
import type { ExpenseListQuery } from '../validators/finance.validator.js';

type Db = PrismaClient | Prisma.TransactionClient;

const EXPENSE_INCLUDE = { car: true } as const;

function buildWhere(agencyId: string, query: ExpenseListQuery): Prisma.ExpenseWhereInput {
  const where = notDeleted<Prisma.ExpenseWhereInput>(
    {
      agencyId,
      category: query.category,
      carId: query.carId,
    },
    { includeArchived: query.includeArchived },
  );

  if (query.from || query.to) {
    where.date = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  // Both `search` and `subcategory` narrow `description`; AND them so they
  // compose instead of one silently overwriting the other.
  const descriptionFilters: Prisma.ExpenseWhereInput[] = [];
  if (query.search)
    descriptionFilters.push({ description: { contains: query.search, mode: 'insensitive' } });
  if (query.subcategory) {
    descriptionFilters.push({ description: { contains: query.subcategory, mode: 'insensitive' } });
  }
  if (descriptionFilters.length === 1) {
    Object.assign(where, descriptionFilters[0]);
  } else if (descriptionFilters.length > 1) {
    where.AND = descriptionFilters;
  }

  return where;
}

export const ExpensesRepository = {
  async findMany(agencyId: string, query: ExpenseListQuery, db: Db = prisma) {
    const where = buildWhere(agencyId, query);
    const [items, total] = await Promise.all([
      db.expense.findMany({
        where,
        include: EXPENSE_INCLUDE,
        orderBy: { date: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.expense.count({ where }),
    ]);
    return { items, total };
  },

  findById(agencyId: string, id: string, options?: { includeArchived?: boolean }, db: Db = prisma) {
    return db.expense.findFirst({
      where: notDeleted({ id, agencyId }, options),
      include: EXPENSE_INCLUDE,
    });
  },

  create(agencyId: string, data: CreateExpenseInput, db: Db = prisma) {
    return db.expense.create({ data: { ...data, agencyId }, include: EXPENSE_INCLUDE });
  },

  update(id: string, data: UpdateExpenseInput, db: Db = prisma) {
    return db.expense.update({ where: { id }, data, include: EXPENSE_INCLUDE });
  },

  archiveById(id: string, db: Db = prisma) {
    return db.expense.update({ where: { id }, data: archive(), include: EXPENSE_INCLUDE });
  },

  restoreById(id: string, db: Db = prisma) {
    return db.expense.update({ where: { id }, data: restore(), include: EXPENSE_INCLUDE });
  },

  // Aggregate for GET /finances/summary, bounded by the expense's own
  // business `date` (when it was incurred), not `createdAt`.
  sumByCategory(agencyId: string, range: { from: Date; to: Date }, db: Db = prisma) {
    return db.expense.groupBy({
      by: ['category'],
      where: notDeleted({ agencyId, date: { gte: range.from, lte: range.to } }),
      _sum: { amount: true },
    });
  },

  async sumTotal(agencyId: string, range: { from: Date; to: Date }, db: Db = prisma) {
    const result = await db.expense.aggregate({
      where: notDeleted({ agencyId, date: { gte: range.from, lte: range.to } }),
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  },
};
