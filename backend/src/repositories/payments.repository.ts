import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma-client.js';

type Db = PrismaClient | Prisma.TransactionClient;

// Minimal repository for Phase 4b's auto-generated LATE_FEE/EXTENSION_PAYMENT
// records. Full Payments CRUD (list, manual entry, attachments, refunds) is
// Phase 5 — do not extend this beyond what the rental lifecycle needs.
export const PaymentsRepository = {
  create(data: Prisma.PaymentUncheckedCreateInput, db: Db = prisma) {
    return db.payment.create({ data });
  },
};
