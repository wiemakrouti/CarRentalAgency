import type { CreateExpenseInput, UpdateExpenseInput } from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { AppError } from '../utils/app-error.js';
import { ExpensesRepository } from '../repositories/expenses.repository.js';
import { AuditService } from './audit.service.js';
import type { ExpenseListQuery } from '../validators/finance.validator.js';

export const ExpensesService = {
  async list(agencyId: string, query: ExpenseListQuery) {
    const { items, total } = await ExpensesRepository.findMany(agencyId, query);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(agencyId: string, id: string, options?: { includeArchived?: boolean }) {
    const expense = await ExpensesRepository.findById(agencyId, id, options);
    if (!expense) {
      throw new AppError(404, 'EXPENSE_NOT_FOUND', 'Dépense introuvable.');
    }
    return expense;
  },

  async create(agencyId: string, input: CreateExpenseInput, userId: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      const expense = await ExpensesRepository.create(agencyId, input, tx);
      await AuditService.record(tx, {
        userId,
        action: 'CREATE',
        entityType: 'Expense',
        entityId: expense.id,
        after: expense,
        ipAddress,
      });
      return expense;
    });
  },

  async update(
    agencyId: string,
    id: string,
    input: UpdateExpenseInput,
    userId: string,
    ipAddress?: string,
  ) {
    const existing = await ExpensesService.getById(agencyId, id);
    return prisma.$transaction(async (tx) => {
      const updated = await ExpensesRepository.update(id, input, tx);
      await AuditService.record(tx, {
        userId,
        action: 'UPDATE',
        entityType: 'Expense',
        entityId: id,
        before: existing,
        after: updated,
        ipAddress,
      });
      return updated;
    });
  },

  async archive(agencyId: string, id: string, userId: string, ipAddress?: string) {
    await ExpensesService.getById(agencyId, id);
    return prisma.$transaction(async (tx) => {
      const archived = await ExpensesRepository.archiveById(id, tx);
      await AuditService.record(tx, {
        userId,
        action: 'DELETE',
        entityType: 'Expense',
        entityId: id,
        ipAddress,
      });
      return archived;
    });
  },

  async restore(agencyId: string, id: string, userId: string, ipAddress?: string) {
    await ExpensesService.getById(agencyId, id, { includeArchived: true });
    return prisma.$transaction(async (tx) => {
      const restored = await ExpensesRepository.restoreById(id, tx);
      await AuditService.record(tx, {
        userId,
        action: 'RESTORE',
        entityType: 'Expense',
        entityId: id,
        ipAddress,
      });
      return restored;
    });
  },
};
