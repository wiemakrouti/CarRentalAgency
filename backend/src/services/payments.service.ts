import type { CreatePaymentInput, UpdatePaymentInput } from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { AppError } from '../utils/app-error.js';
import { deleteCloudinaryImage, isCloudinaryConfigured, uploadImageBuffer } from '../lib/cloudinary-client.js';
import { PaymentsRepository } from '../repositories/payments.repository.js';
import { RentalsRepository } from '../repositories/rentals.repository.js';
import { RentalsService } from './rentals.service.js';
import { AuditService } from './audit.service.js';
import type { PaymentListQuery } from '../validators/finance.validator.js';

export const PaymentsService = {
  async list(query: PaymentListQuery) {
    const { items, total } = await PaymentsRepository.findMany(query);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(id: string, options?: { includeArchived?: boolean }) {
    const payment = await PaymentsRepository.findById(id, options);
    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');
    }
    return payment;
  },

  // Manual entry always records money already received — `status` isn't
  // client-settable here (see `update` for correcting/settling the PENDING
  // rows Rentals auto-generates for late fees/damage/extensions).
  async create(input: CreatePaymentInput, userId: string, ipAddress?: string) {
    await RentalsService.getById(input.rentalId);

    return prisma.$transaction(async (tx) => {
      const payment = await PaymentsRepository.create(
        {
          rentalId: input.rentalId,
          amount: input.amount,
          method: input.method,
          type: input.type,
          status: 'COMPLETED',
          paidAt: input.paidAt ?? new Date(),
          notes: input.notes ?? null,
        },
        tx,
      );

      // Business rule (Phase 5): recording a DEPOSIT_REFUND payment is how
      // the admin marks the deposit as handed back — keep the two facts in
      // sync atomically instead of requiring a separate manual toggle that
      // could drift from the actual payment record.
      if (input.type === 'DEPOSIT_REFUND') {
        await RentalsRepository.markDepositReturned(input.rentalId, tx);
      }

      await AuditService.record(tx, {
        userId,
        action: 'CREATE',
        entityType: 'Payment',
        entityId: payment.id,
        after: payment,
        ipAddress,
      });
      return payment;
    });
  },

  // Correct/settle a payment: fix amount/method, mark PENDING -> COMPLETED
  // once collected, etc. `type` is immutable (see finance.schema.ts).
  async update(id: string, input: UpdatePaymentInput, userId: string, ipAddress?: string) {
    const existing = await PaymentsService.getById(id);
    return prisma.$transaction(async (tx) => {
      const updated = await PaymentsRepository.update(id, input, tx);
      await AuditService.record(tx, {
        userId,
        action: 'UPDATE',
        entityType: 'Payment',
        entityId: id,
        before: existing,
        after: updated,
        ipAddress,
      });
      return updated;
    });
  },

  async archive(id: string, userId: string, ipAddress?: string) {
    await PaymentsService.getById(id);
    return prisma.$transaction(async (tx) => {
      const archived = await PaymentsRepository.archiveById(id, tx);
      await AuditService.record(tx, {
        userId,
        action: 'DELETE',
        entityType: 'Payment',
        entityId: id,
        ipAddress,
      });
      return archived;
    });
  },

  async restore(id: string, userId: string, ipAddress?: string) {
    await PaymentsService.getById(id, { includeArchived: true });
    return prisma.$transaction(async (tx) => {
      const restored = await PaymentsRepository.restoreById(id, tx);
      await AuditService.record(tx, {
        userId,
        action: 'RESTORE',
        entityType: 'Payment',
        entityId: id,
        ipAddress,
      });
      return restored;
    });
  },

  async addAttachment(paymentId: string, file: { buffer: Buffer }, userId: string, ipAddress?: string) {
    if (!isCloudinaryConfigured()) {
      throw new AppError(503, 'IMAGE_STORAGE_NOT_CONFIGURED', "Le stockage d'images n'est pas configuré.");
    }

    await PaymentsService.getById(paymentId);

    const uploaded = await uploadImageBuffer(file.buffer, `payments/${paymentId}`);

    return prisma.$transaction(async (tx) => {
      const attachment = await PaymentsRepository.addAttachment(paymentId, uploaded, tx);
      await AuditService.record(tx, {
        userId,
        action: 'PAYMENT_ATTACHMENT_ADD',
        entityType: 'Payment',
        entityId: paymentId,
        after: { attachmentId: attachment.id, url: attachment.url },
        ipAddress,
      });
      return attachment;
    });
  },

  async removeAttachment(paymentId: string, attachmentId: string, userId: string, ipAddress?: string) {
    const attachment = await PaymentsRepository.findAttachmentById(attachmentId);
    if (!attachment || attachment.paymentId !== paymentId) {
      throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Pièce jointe introuvable.');
    }

    await prisma.$transaction(async (tx) => {
      await PaymentsRepository.deleteAttachmentById(attachmentId, tx);
      await AuditService.record(tx, {
        userId,
        action: 'PAYMENT_ATTACHMENT_REMOVE',
        entityType: 'Payment',
        entityId: paymentId,
        before: { attachmentId, url: attachment.url },
        ipAddress,
      });
    });

    try {
      await deleteCloudinaryImage(attachment.publicId);
    } catch (err) {
      console.error(`Failed to delete Cloudinary asset ${attachment.publicId}:`, err);
    }
  },
};
