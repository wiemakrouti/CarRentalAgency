import type { Prisma, PrismaClient } from '@prisma/client';
import type { CreateExpenseInput, UpdateExpenseInput } from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { archive, notDeleted, restore } from './soft-delete.js';
import type { ExpenseListQuery } from '../validators/finance.validator.js';

type Db = PrismaClient | Prisma.TransactionClient;

const EXPENSE_INCLUDE = { car: true } as const;

function buildWhere(query: ExpenseListQuery): Prisma.ExpenseWhereInput {
  const where = notDeleted<Prisma.ExpenseWhereInput>(
    {
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

  if (query.search) {
    where.description = { contains: query.search, mode: 'insensitive' };
  }

  return where;
}

export const ExpensesRepository = {
  async findMany(query: ExpenseListQuery, db: Db = prisma) {
    const where = buildWhere(query);
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

  findById(id: string, options?: { includeArchived?: boolean }, db: Db = prisma) {
    return db.expense.findFirst({
      where: notDeleted({ id }, options),
      include: EXPENSE_INCLUDE,
    });
  },

  create(data: CreateExpenseInput, db: Db = prisma) {
    return db.expense.create({ data, include: EXPENSE_INCLUDE });
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
  sumByCategory(range: { from: Date; to: Date }, db: Db = prisma) {
    return db.expense.groupBy({
      by: ['category'],
      where: notDeleted({ date: { gte: range.from, lte: range.to } }),
      _sum: { amount: true },
    });
  },

  async sumTotal(range: { from: Date; to: Date }, db: Db = prisma) {
    const result = await db.expense.aggregate({
      where: notDeleted({ date: { gte: range.from, lte: range.to } }),
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  },
};
