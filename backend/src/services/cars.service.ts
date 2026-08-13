import { Prisma } from '@prisma/client';
import type { Car } from '@prisma/client';
import type { CreateCarInput, UpdateCarInput } from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { AppError } from '../utils/app-error.js';
import { toCsv } from '../utils/csv.js';
import {
  deleteCloudinaryImage,
  isCloudinaryConfigured,
  uploadImageBuffer,
} from '../lib/cloudinary-client.js';
import { CarsRepository } from '../repositories/cars.repository.js';
import { AuditService } from './audit.service.js';
import type { AvailableQuery, CarExportQuery, CarListQuery } from '../validators/car.validator.js';

// French labels for the CSV export only — the frontend's own copies
// (car-labels.ts) aren't reachable from the backend, and this is the one
// place the backend renders an enum for a human rather than an API client.
const CATEGORY_LABELS: Record<string, string> = {
  ECONOMY: 'Économique',
  COMPACT: 'Compacte',
  SUV: 'SUV',
  LUXURY: 'Luxe',
  VAN: 'Utilitaire',
};
const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible',
  RENTED: 'Louée',
  MAINTENANCE: 'Maintenance',
  OUT_OF_SERVICE: 'Hors service',
};
const TRANSMISSION_LABELS: Record<string, string> = {
  MANUAL: 'Manuelle',
  AUTOMATIC: 'Automatique',
};
const FUEL_TYPE_LABELS: Record<string, string> = {
  GASOLINE: 'Essence',
  DIESEL: 'Diesel',
  HYBRID: 'Hybride',
  ELECTRIC: 'Électrique',
};

function formatCsvDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '';
}

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

function toDuplicateLicensePlateError(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === UNIQUE_CONSTRAINT_VIOLATION
  ) {
    throw new AppError(
      409,
      'DUPLICATE_LICENSE_PLATE',
      'Une voiture avec cette immatriculation existe déjà.',
    );
  }
  throw err;
}

export const CarsService = {
  async list(query: CarListQuery) {
    const { items, total } = await CarsRepository.findMany(query);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(id: string, options?: { includeArchived?: boolean }) {
    const car = await CarsRepository.findById(id, options);
    if (!car) {
      throw new AppError(404, 'CAR_NOT_FOUND', 'Voiture introuvable.');
    }
    return car;
  },

  async create(input: CreateCarInput, userId: string, ipAddress?: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const car = await CarsRepository.create(input, tx);
        await AuditService.record(tx, {
          userId,
          action: 'CREATE',
          entityType: 'Car',
          entityId: car.id,
          after: car,
          ipAddress,
        });
        return car;
      });
    } catch (err) {
      toDuplicateLicensePlateError(err);
    }
  },

  async update(id: string, input: UpdateCarInput, userId: string, ipAddress?: string) {
    const existing = await CarsService.getById(id);
    try {
      return await prisma.$transaction(async (tx) => {
        const updated = await CarsRepository.update(id, input, tx);
        await AuditService.record(tx, {
          userId,
          action: 'UPDATE',
          entityType: 'Car',
          entityId: id,
          before: existing,
          after: updated,
          ipAddress,
        });
        return updated;
      });
    } catch (err) {
      toDuplicateLicensePlateError(err);
    }
  },

  async archive(id: string, userId: string, ipAddress?: string) {
    await CarsService.getById(id);
    return prisma.$transaction(async (tx) => {
      const archived = await CarsRepository.archiveById(id, tx);
      await AuditService.record(tx, {
        userId,
        action: 'DELETE',
        entityType: 'Car',
        entityId: id,
        ipAddress,
      });
      return archived;
    });
  },

  async restore(id: string, userId: string, ipAddress?: string) {
    await CarsService.getById(id, { includeArchived: true });
    return prisma.$transaction(async (tx) => {
      const restored = await CarsRepository.restoreById(id, tx);
      await AuditService.record(tx, {
        userId,
        action: 'RESTORE',
        entityType: 'Car',
        entityId: id,
        ipAddress,
      });
      return restored;
    });
  },

  // All-or-nothing: one transaction touching every id, same guarantee as
  // archiving/updating a single car — a partial bulk failure would leave the
  // admin unsure which of their selection actually changed.
  async bulkArchive(ids: string[], userId: string, ipAddress?: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.car.findMany({ where: { id: { in: ids }, deletedAt: null } });
      if (existing.length !== ids.length) {
        throw new AppError(404, 'CAR_NOT_FOUND', 'Une ou plusieurs voitures sont introuvables.');
      }
      const archived = [];
      for (const car of existing) {
        archived.push(await CarsRepository.archiveById(car.id, tx));
        await AuditService.record(tx, {
          userId,
          action: 'DELETE',
          entityType: 'Car',
          entityId: car.id,
          ipAddress,
        });
      }
      return archived;
    });
  },

  async bulkUpdateStatus(
    ids: string[],
    status: UpdateCarInput['status'],
    userId: string,
    ipAddress?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.car.findMany({ where: { id: { in: ids }, deletedAt: null } });
      if (existing.length !== ids.length) {
        throw new AppError(404, 'CAR_NOT_FOUND', 'Une ou plusieurs voitures sont introuvables.');
      }
      const updated = [];
      for (const car of existing) {
        const result = await CarsRepository.update(car.id, { status }, tx);
        updated.push(result);
        await AuditService.record(tx, {
          userId,
          action: 'UPDATE',
          entityType: 'Car',
          entityId: car.id,
          before: { status: car.status },
          after: { status: result.status },
          ipAddress,
        });
      }
      return updated;
    });
  },

  getAvailable(query: AvailableQuery) {
    return CarsRepository.findAvailable(query);
  },

  async getStats(id: string) {
    await CarsService.getById(id, { includeArchived: true });
    return CarsRepository.getStats(id);
  },

  async exportCsv(query: CarExportQuery): Promise<string> {
    const cars = await CarsRepository.findAllForExport(query);
    return toCsv<Car>(cars, [
      { header: 'Immatriculation', value: (c) => c.licensePlate },
      { header: 'VIN', value: (c) => c.vin ?? '' },
      { header: 'Marque', value: (c) => c.brand },
      { header: 'Modèle', value: (c) => c.model },
      { header: 'Année', value: (c) => c.year },
      { header: 'Couleur', value: (c) => c.color },
      { header: 'Catégorie', value: (c) => CATEGORY_LABELS[c.category] ?? c.category },
      {
        header: 'Transmission',
        value: (c) => TRANSMISSION_LABELS[c.transmission] ?? c.transmission,
      },
      { header: 'Carburant', value: (c) => FUEL_TYPE_LABELS[c.fuelType] ?? c.fuelType },
      { header: 'Places', value: (c) => c.seats },
      { header: 'Kilométrage', value: (c) => c.mileage },
      { header: 'Tarif / jour (DT)', value: (c) => c.dailyRate.toString() },
      { header: 'Statut', value: (c) => STATUS_LABELS[c.status] ?? c.status },
      { header: "Date d'achat", value: (c) => formatCsvDate(c.purchaseDate) },
      { header: "Prix d'achat (DT)", value: (c) => c.purchasePrice?.toString() ?? '' },
      { header: 'Expiration assurance', value: (c) => formatCsvDate(c.insuranceExpiryDate) },
      {
        header: 'Expiration contrôle technique',
        value: (c) => formatCsvDate(c.technicalInspectionExpiryDate),
      },
      { header: 'Expiration carte grise', value: (c) => formatCsvDate(c.registrationExpiryDate) },
    ]);
  },

  async addImage(
    carId: string,
    file: { buffer: Buffer },
    isPrimary: boolean,
    userId: string,
    ipAddress?: string,
  ) {
    if (!isCloudinaryConfigured()) {
      throw new AppError(
        503,
        'IMAGE_STORAGE_NOT_CONFIGURED',
        "Le stockage d'images n'est pas configuré.",
      );
    }

    await CarsService.getById(carId);

    // Must upload before writing the row: the row needs the resulting url/publicId.
    // An upload that succeeds but is then never attached to a car (transaction
    // failure below) leaves an orphaned Cloudinary asset — an acceptable cost,
    // versus a CarImage row referencing an asset that was never actually created.
    const uploaded = await uploadImageBuffer(file.buffer, `cars/${carId}`);

    return prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await CarsRepository.unsetPrimaryImages(carId, tx);
      }
      const image = await CarsRepository.addImage(carId, { ...uploaded, isPrimary }, tx);
      await AuditService.record(tx, {
        userId,
        action: 'CAR_IMAGE_ADD',
        entityType: 'Car',
        entityId: carId,
        after: { imageId: image.id, url: image.url },
        ipAddress,
      });
      return image;
    });
  },

  async removeImage(carId: string, imageId: string, userId: string, ipAddress?: string) {
    const image = await CarsRepository.findImageById(imageId);
    if (!image || image.carId !== carId) {
      throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image introuvable.');
    }

    // DB first, Cloudinary cleanup best-effort after: a leftover unused
    // Cloudinary asset is a harmless cost, whereas deleting the cloud asset
    // first and then failing the DB delete would leave a CarImage row
    // pointing at nothing — a broken image in the UI.
    await prisma.$transaction(async (tx) => {
      await CarsRepository.deleteImageById(imageId, tx);
      await AuditService.record(tx, {
        userId,
        action: 'CAR_IMAGE_REMOVE',
        entityType: 'Car',
        entityId: carId,
        before: { imageId, url: image.url },
        ipAddress,
      });
    });

    try {
      await deleteCloudinaryImage(image.publicId);
    } catch (err) {
      console.error(`Failed to delete Cloudinary asset ${image.publicId}:`, err);
    }
  },

  async setPrimaryImage(carId: string, imageId: string, userId: string, ipAddress?: string) {
    const image = await CarsRepository.findImageById(imageId);
    if (!image || image.carId !== carId) {
      throw new AppError(404, 'IMAGE_NOT_FOUND', 'Image introuvable.');
    }

    return prisma.$transaction(async (tx) => {
      await CarsRepository.unsetPrimaryImages(carId, tx);
      const updated = await CarsRepository.setImagePrimary(imageId, tx);
      await AuditService.record(tx, {
        userId,
        action: 'CAR_IMAGE_SET_PRIMARY',
        entityType: 'Car',
        entityId: carId,
        after: { imageId },
        ipAddress,
      });
      return updated;
    });
  },
};
