import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditAction } from '@car-rental/shared';

interface RecordAuditEntryInput {
  userId: string | null;
  action: AuditAction | string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
}

// Called explicitly from inside each mutating service method (not generic
// middleware) so entries carry meaningful before/after diffs and a domain
// action name (e.g. RENTAL_ACTIVATE) instead of a generic "UPDATE /rentals/:id".
// See docs/architecture.md §1 for why.
export class AuditService {
  // Accepts a PrismaClient OR a transaction client so callers can pass `tx`
  // from prisma.$transaction(...) and have the audit write commit/rollback
  // atomically with the business mutation it describes.
  static async record(
    db: PrismaClient | Prisma.TransactionClient,
    entry: RecordAuditEntryInput,
  ): Promise<void> {
    await db.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        previousValues: entry.before as Prisma.InputJsonValue,
        newValues: entry.after as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress,
      },
    });
  }
}
