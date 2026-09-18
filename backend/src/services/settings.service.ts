import type { UpdateSettingsInput } from '@car-rental/shared';
import { AppError } from '../utils/app-error.js';
import { prisma } from '../lib/prisma-client.js';
import { isCloudinaryConfigured, uploadImageBuffer } from '../lib/cloudinary-client.js';
import { SettingsRepository } from '../repositories/settings.repository.js';
import { AuditService } from './audit.service.js';

export const SettingsService = {
  async get(agencyId: string) {
    const settings = await SettingsRepository.get(agencyId);
    if (!settings) {
      // Only reachable if the seed's singleton row was deleted by hand —
      // there is no create-on-read here because Setting has no sensible
      // ad-hoc default for every field (a Settings page rendering random
      // defaults the admin never chose would be worse than a clear error).
      throw new AppError(
        500,
        'SETTINGS_NOT_FOUND',
        "Les paramètres de l'agence sont introuvables.",
      );
    }
    return settings;
  },

  async update(agencyId: string, input: UpdateSettingsInput, userId: string, ipAddress?: string) {
    const existing = await SettingsRepository.get(agencyId);
    if (!existing) {
      throw new AppError(
        500,
        'SETTINGS_NOT_FOUND',
        "Les paramètres de l'agence sont introuvables.",
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await SettingsRepository.update(existing.id, input, tx);
      await AuditService.record(tx, {
        userId,
        action: 'SETTINGS_UPDATE',
        entityType: 'Setting',
        entityId: existing.id,
        before: existing,
        after: updated,
        ipAddress,
      });
      return updated;
    });
  },

  async uploadLogo(agencyId: string, file: { buffer: Buffer }, userId: string, ipAddress?: string) {
    if (!isCloudinaryConfigured()) {
      throw new AppError(
        503,
        'IMAGE_STORAGE_NOT_CONFIGURED',
        "Le stockage d'images n'est pas configuré.",
      );
    }

    const existing = await SettingsRepository.get(agencyId);
    if (!existing) {
      throw new AppError(
        500,
        'SETTINGS_NOT_FOUND',
        "Les paramètres de l'agence sont introuvables.",
      );
    }

    // Single fixed folder, not per-id — fine even multi-tenant, since each
    // upload's filename is randomized by Cloudinary regardless of agency.
    // The previous Cloudinary asset (if any) is left in place rather than
    // deleted: same trade-off as
    // CarsService.addImage — uploading before the DB write can't know yet
    // whether the transaction below will actually succeed.
    const uploaded = await uploadImageBuffer(file.buffer, 'settings/logo');

    return prisma.$transaction(async (tx) => {
      const updated = await SettingsRepository.update(existing.id, { logoUrl: uploaded.url }, tx);
      await AuditService.record(tx, {
        userId,
        action: 'SETTINGS_LOGO_UPDATE',
        entityType: 'Setting',
        entityId: existing.id,
        before: { logoUrl: existing.logoUrl },
        after: { logoUrl: updated.logoUrl },
        ipAddress,
      });
      return updated;
    });
  },
};
