import type { ApprovalRequest, Prisma } from '@prisma/client';
import {
  createExpenseSchema,
  createRentalSchema,
  updateExpenseSchema,
  type ApprovalListQuery,
  type CreateExpenseInput,
  type CreateRentalInput,
  type Role,
  type UpdateCarInput,
  type UpdateExpenseInput,
} from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { AppError } from '../utils/app-error.js';
import { ApprovalsRepository } from '../repositories/approvals.repository.js';
import { RentalsRepository } from '../repositories/rentals.repository.js';
import { SettingsRepository } from '../repositories/settings.repository.js';
import { AuditService } from './audit.service.js';
import { CarsService } from './cars.service.js';
import { ClientsService } from './clients.service.js';
import { ExpensesService } from './expenses.service.js';
import { RentalsService } from './rentals.service.js';

export type Actor = { id: string; role: Role };

const DEFAULT_EXPENSE_THRESHOLD = 500;
const DEFAULT_DISCOUNT_THRESHOLD = 15;

// What an employee's submission turned into: the action itself, or a
// request waiting for the director.
export type Submission<T> = { approvalRequest: null; result: T } | { approvalRequest: ApprovalRequest; result: null };

function carLabel(car: { brand: string; model: string; licensePlate: string }) {
  return `${car.brand} ${car.model} (${car.licensePlate})`;
}

async function thresholds(agencyId: string) {
  const settings = await SettingsRepository.get(agencyId);
  return {
    expense: Number(settings?.largeExpenseThreshold ?? DEFAULT_EXPENSE_THRESHOLD),
    discount: settings?.largeDiscountThreshold ?? DEFAULT_DISCOUNT_THRESHOLD,
  };
}

// The request as stored: dates become ISO strings, re-parsed by the same
// zod schema when the director approves.
function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function createRequest(
  agencyId: string,
  actor: Actor,
  data: { type: ApprovalRequest['type']; payload: unknown; summary: Record<string, unknown>; entityId?: string },
  ipAddress?: string,
) {
  return prisma.$transaction(async (tx) => {
    const request = await ApprovalsRepository.create(
      {
        agencyId,
        type: data.type,
        payload: asJson(data.payload),
        summary: asJson(data.summary),
        entityId: data.entityId ?? null,
        requestedById: actor.id,
      },
      tx,
    );
    await AuditService.record(tx, {
      userId: actor.id,
      action: 'APPROVAL_REQUEST',
      entityType: 'ApprovalRequest',
      entityId: request.id,
      after: { type: request.type, summary: request.summary },
      ipAddress,
    });
    return request;
  });
}

// Three actions an employee can't do alone: change a car's catalogue rate,
// record a large expense, book at a large discount. Submitted through the
// usual endpoints (same forms, same buttons): for an employee crossing a
// threshold they become a request, executed only once the director
// approves — on the employee's behalf, re-validated at that moment. The
// director's own actions never need approval. Everything else an employee
// does goes straight through and only shows in the activity journal.
export const ApprovalsService = {
  // ---------- Submissions (the three guarded actions) ----------

  async submitRental(
    agencyId: string,
    input: CreateRentalInput,
    actor: Actor,
    ipAddress?: string,
  ): Promise<Submission<Awaited<ReturnType<typeof RentalsService.create>>>> {
    if (actor.role !== 'EMPLOYEE' || input.dailyRate === undefined) {
      return { approvalRequest: null, result: await RentalsService.create(agencyId, input, actor.id, ipAddress) };
    }
    const car = await CarsService.getById(agencyId, input.carId);
    const catalog = Number(car.dailyRate);
    const discountPercent = catalog > 0 ? ((catalog - input.dailyRate) / catalog) * 100 : 0;
    const { discount: threshold } = await thresholds(agencyId);
    if (discountPercent <= threshold) {
      return { approvalRequest: null, result: await RentalsService.create(agencyId, input, actor.id, ipAddress) };
    }

    // Catch what would fail anyway before the director is asked: the client
    // exists, the car is free on these dates. Re-checked at approval.
    const client = await ClientsService.getById(agencyId, input.clientId);
    const overlapping = await RentalsRepository.hasOverlap(input.carId, {
      pickupDate: input.pickupDate,
      returnDate: input.plannedReturnDate,
    });
    if (overlapping) {
      throw new AppError(409, 'CAR_NOT_AVAILABLE', 'Cette voiture est déjà réservée pour ces dates.');
    }
    const nights = Math.max(
      Math.round((input.plannedReturnDate.getTime() - input.pickupDate.getTime()) / (24 * 60 * 60 * 1000)),
      1,
    );
    const request = await createRequest(
      agencyId,
      actor,
      {
        type: 'LARGE_DISCOUNT',
        payload: input,
        summary: {
          car: carLabel(car),
          client: `${client.firstName} ${client.lastName}`,
          pickupDate: input.pickupDate,
          plannedReturnDate: input.plannedReturnDate,
          immediate: Boolean(input.activation),
          dailyRate: input.dailyRate,
          catalogDailyRate: catalog,
          discountPercent: Math.round(discountPercent),
          totalAmount: input.dailyRate * nights,
        },
      },
      ipAddress,
    );
    return { approvalRequest: request, result: null };
  },

  async submitExpense(
    agencyId: string,
    input: CreateExpenseInput,
    actor: Actor,
    ipAddress?: string,
  ): Promise<Submission<Awaited<ReturnType<typeof ExpensesService.create>>>> {
    const { expense: threshold } = await thresholds(agencyId);
    if (actor.role !== 'EMPLOYEE' || input.amount < threshold) {
      return { approvalRequest: null, result: await ExpensesService.create(agencyId, input, actor.id, ipAddress) };
    }
    const car = input.carId ? await CarsService.getById(agencyId, input.carId) : null;
    const request = await createRequest(
      agencyId,
      actor,
      {
        type: 'LARGE_EXPENSE',
        payload: { create: input },
        summary: {
          amount: input.amount,
          category: input.category,
          description: input.description,
          date: input.date,
          car: car ? carLabel(car) : null,
        },
      },
      ipAddress,
    );
    return { approvalRequest: request, result: null };
  },

  // Raising an existing expense to the threshold or above is a large
  // expense too — otherwise a small one could be edited past the rule.
  async submitExpenseUpdate(
    agencyId: string,
    id: string,
    input: UpdateExpenseInput,
    actor: Actor,
    ipAddress?: string,
  ): Promise<Submission<Awaited<ReturnType<typeof ExpensesService.update>>>> {
    const { expense: threshold } = await thresholds(agencyId);
    const existing = await ExpensesService.getById(agencyId, id);
    const before = Number(existing.amount);
    const raised = input.amount !== undefined && input.amount >= threshold && input.amount > before;
    if (actor.role !== 'EMPLOYEE' || !raised) {
      return { approvalRequest: null, result: await ExpensesService.update(agencyId, id, input, actor.id, ipAddress) };
    }
    const request = await createRequest(
      agencyId,
      actor,
      {
        type: 'LARGE_EXPENSE',
        payload: { update: input, expenseId: id },
        entityId: id,
        summary: {
          amount: input.amount,
          previousAmount: before,
          category: input.category ?? existing.category,
          description: input.description ?? existing.description,
          date: input.date ?? existing.date,
          car: existing.car ? carLabel(existing.car) : null,
        },
      },
      ipAddress,
    );
    return { approvalRequest: request, result: null };
  },

  // A car edit by an employee: every field but the catalogue rate is saved
  // right away; a new rate becomes a request.
  async submitCarUpdate(agencyId: string, id: string, input: UpdateCarInput, actor: Actor, ipAddress?: string) {
    const existing = await CarsService.getById(agencyId, id);
    const priceChanged = input.dailyRate !== undefined && input.dailyRate !== Number(existing.dailyRate);
    if (actor.role !== 'EMPLOYEE' || !priceChanged) {
      return { approvalRequest: null, car: await CarsService.update(agencyId, id, input, actor.id, ipAddress) };
    }
    const { dailyRate, ...rest } = input;
    const hasOtherChanges = Object.values(rest).some((value) => value !== undefined);
    const car = hasOtherChanges ? await CarsService.update(agencyId, id, rest, actor.id, ipAddress) : existing;
    const approvalRequest = await createRequest(
      agencyId,
      actor,
      {
        type: 'CAR_PRICE_CHANGE',
        payload: { dailyRate },
        entityId: id,
        summary: { car: carLabel(existing), from: Number(existing.dailyRate), to: dailyRate },
      },
      ipAddress,
    );
    return { approvalRequest, car };
  },

  // ---------- Reading ----------

  // The director sees every request of the agency; an employee only theirs.
  list(agencyId: string, actor: Actor, query: ApprovalListQuery) {
    return ApprovalsRepository.findMany(agencyId, {
      status: query.status,
      requestedById: actor.role === 'ADMIN' ? undefined : actor.id,
      take: 100,
    });
  },

  async markDecisionsSeen(actor: Actor) {
    await ApprovalsRepository.markDecisionsSeen(actor.id);
  },

  // ---------- Decisions ----------

  async approve(agencyId: string, id: string, director: Actor, ipAddress?: string) {
    const request = await ApprovalsService.getPending(agencyId, id);
    const claimed = await ApprovalsRepository.transitionFromPending(id, {
      status: 'APPROVED',
      decidedById: director.id,
      decidedAt: new Date(),
    });
    if (!claimed) throw alreadyDecided();

    let entityId: string;
    try {
      entityId = await execute(agencyId, request, ipAddress);
    } catch (err) {
      // The action couldn't happen (car booked meanwhile, immediate rental
      // approved too late...): nothing was created, the request waits again.
      await ApprovalsRepository.revertToPending(id);
      throw err;
    }

    const updated = await ApprovalsRepository.setEntityId(id, entityId);
    await AuditService.record(prisma, {
      userId: director.id,
      action: 'APPROVAL_APPROVE',
      entityType: 'ApprovalRequest',
      entityId: id,
      after: { type: request.type, summary: request.summary, requestedBy: request.requestedBy.fullName },
      ipAddress,
    });
    return updated;
  },

  async reject(agencyId: string, id: string, director: Actor, ipAddress?: string) {
    const request = await ApprovalsService.getPending(agencyId, id);
    return prisma.$transaction(async (tx) => {
      const done = await ApprovalsRepository.transitionFromPending(
        id,
        { status: 'REJECTED', decidedById: director.id, decidedAt: new Date() },
        tx,
      );
      if (!done) throw alreadyDecided();
      await AuditService.record(tx, {
        userId: director.id,
        action: 'APPROVAL_REJECT',
        entityType: 'ApprovalRequest',
        entityId: id,
        after: { type: request.type, summary: request.summary, requestedBy: request.requestedBy.fullName },
        ipAddress,
      });
      return ApprovalsRepository.findById(agencyId, id, tx);
    });
  },

  // The employee takes back their own request while it still waits.
  async withdraw(agencyId: string, id: string, actor: Actor, ipAddress?: string) {
    const request = await ApprovalsService.getPending(agencyId, id);
    if (request.requestedById !== actor.id) {
      throw new AppError(403, 'FORBIDDEN', 'Vous ne pouvez retirer que vos propres demandes.');
    }
    return prisma.$transaction(async (tx) => {
      const done = await ApprovalsRepository.transitionFromPending(id, { status: 'WITHDRAWN' }, tx);
      if (!done) throw alreadyDecided();
      await AuditService.record(tx, {
        userId: actor.id,
        action: 'APPROVAL_WITHDRAW',
        entityType: 'ApprovalRequest',
        entityId: id,
        after: { type: request.type, summary: request.summary },
        ipAddress,
      });
      return ApprovalsRepository.findById(agencyId, id, tx);
    });
  },

  async getPending(agencyId: string, id: string) {
    const request = await ApprovalsRepository.findById(agencyId, id);
    if (!request) throw new AppError(404, 'APPROVAL_NOT_FOUND', 'Demande introuvable.');
    if (request.status !== 'PENDING') throw alreadyDecided();
    return request;
  },
};

function alreadyDecided() {
  return new AppError(409, 'APPROVAL_ALREADY_DECIDED', 'Cette demande a déjà été traitée.');
}

// Runs the approved action as the employee who asked for it (the journal
// shows it under their name), from their original request re-validated now.
// Returns the id of the record it touched.
async function execute(
  agencyId: string,
  request: NonNullable<Awaited<ReturnType<typeof ApprovalsRepository.findById>>>,
  ipAddress?: string,
): Promise<string> {
  const payload = request.payload as Record<string, unknown>;
  const asEmployee = request.requestedById;

  switch (request.type) {
    case 'LARGE_DISCOUNT': {
      const input = createRentalSchema.parse(payload);
      const rental = await RentalsService.create(agencyId, input, asEmployee, ipAddress);
      return rental!.id;
    }
    case 'LARGE_EXPENSE': {
      if (payload.expenseId) {
        const input = updateExpenseSchema.parse(payload.update);
        const expense = await ExpensesService.update(agencyId, String(payload.expenseId), input, asEmployee, ipAddress);
        return expense.id;
      }
      const expense = await ExpensesService.create(agencyId, createExpenseSchema.parse(payload.create), asEmployee, ipAddress);
      return expense.id;
    }
    case 'CAR_PRICE_CHANGE': {
      const car = await CarsService.update(
        agencyId,
        request.entityId!,
        { dailyRate: Number(payload.dailyRate) },
        asEmployee,
        ipAddress,
      );
      return car!.id;
    }
  }
}
