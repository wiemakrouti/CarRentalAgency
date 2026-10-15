import type { ApprovalStatus, ApprovalType, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma-client.js';

type Db = PrismaClient | Prisma.TransactionClient;

const PEOPLE_INCLUDE = {
  requestedBy: { select: { id: true, fullName: true } },
  decidedBy: { select: { id: true, fullName: true } },
} as const;

export const ApprovalsRepository = {
  create(
    data: {
      agencyId: string;
      type: ApprovalType;
      payload: Prisma.InputJsonValue;
      summary: Prisma.InputJsonValue;
      entityId?: string | null;
      requestedById: string;
    },
    db: Db = prisma,
  ) {
    return db.approvalRequest.create({ data, include: PEOPLE_INCLUDE });
  },

  findById(agencyId: string, id: string, db: Db = prisma) {
    return db.approvalRequest.findFirst({ where: { id, agencyId }, include: PEOPLE_INCLUDE });
  },

  // Newest first. `requestedById` narrows to one employee's own requests.
  findMany(
    agencyId: string,
    filter: { status?: ApprovalStatus; requestedById?: string; take?: number },
    db: Db = prisma,
  ) {
    return db.approvalRequest.findMany({
      where: { agencyId, status: filter.status, requestedById: filter.requestedById },
      include: PEOPLE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: filter.take,
    });
  },

  // Moves a request out of PENDING only if it still is — two clicks (or the
  // director and the employee withdrawing at once) can't both decide it.
  // Returns false when someone else got there first.
  async transitionFromPending(
    id: string,
    data: { status: ApprovalStatus; decidedById?: string | null; decidedAt?: Date | null },
    db: Db = prisma,
  ) {
    const { count } = await db.approvalRequest.updateMany({ where: { id, status: 'PENDING' }, data });
    return count === 1;
  },

  // Undoes a claimed approval whose action then failed (the car got booked
  // meanwhile...): the request goes back to waiting for a decision.
  revertToPending(id: string, db: Db = prisma) {
    return db.approvalRequest.update({
      where: { id },
      data: { status: 'PENDING', decidedById: null, decidedAt: null },
    });
  },

  setEntityId(id: string, entityId: string, db: Db = prisma) {
    return db.approvalRequest.update({ where: { id }, data: { entityId }, include: PEOPLE_INCLUDE });
  },

  markDecisionsSeen(requestedById: string, db: Db = prisma) {
    return db.approvalRequest.updateMany({
      where: { requestedById, status: { in: ['APPROVED', 'REJECTED'] }, requesterSeenAt: null },
      data: { requesterSeenAt: new Date() },
    });
  },
};
