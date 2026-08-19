import { Prisma } from '@prisma/client';
import type { Car } from '@prisma/client';
import type { CreateCarInput, UpdateCarInput } from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { AppError } from '../utils/app-error.js';
import { toCsv } from '../utils/csv.js';
import { toXlsxBuffer } from '../utils/xlsx.js';
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

const HAS_HISTORY_MESSAGE =
  'Cette voiture a un historique (locations, dépenses ou maintenance) et ne peut pas être supprimée définitivement.';

async function hasHistory(carId: string): Promise<boolean> {
  const relations = await CarsRepository.countRelations(carId);
  return relations.rentals > 0 || relations.expenses > 0 || relations.maintenanceRecords > 0;
}

async function assertNoHistory(carId: string): Promise<void> {
  if (await hasHistory(carId)) {
    throw new AppError(409, 'CAR_HAS_HISTORY', HAS_HISTORY_MESSAGE);
  }
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

  async getById(id: string) {
    const car = await CarsRepository.findById(id);
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
    // The only way to take a car out of RENTED is returning its rental
    // (RentalsService.returnRental, via CarsRepository.updateStatusGuarded) —
    // never trust the client to have checked this itself.
    if (input.status && existing.status === 'RENTED') {
      throw new AppError(
        409,
        'CAR_CURRENTLY_RENTED',
        'Cette voiture est en cours de location. Retournez la location pour changer son statut.',
      );
    }
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

  // Non-mutating precheck so the frontend's delete confirmation dialog can
  // show the right content (destructive confirm vs. explanatory notice)
  // before the admin ever clicks the button, instead of only finding out
  // after submitting that CAR_HAS_HISTORY was going to reject it.
  async checkDeletable(id: string) {
    await CarsService.getById(id);
    const blocked = await hasHistory(id);
    return { canDelete: !blocked, reason: blocked ? HAS_HISTORY_MESSAGE : null };
  },

  async checkBulkDeletable(ids: string[]) {
    await Promise.all(ids.map((id) => CarsService.getById(id)));
    const results = await Promise.all(ids.map((id) => hasHistory(id)));
    const blockedCount = results.filter(Boolean).length;
    return {
      canDelete: blockedCount === 0,
      blockedCount,
      reason:
        blockedCount > 0
          ? `${blockedCount} voiture(s) sur ${ids.length} ${blockedCount > 1 ? 'ont' : 'a'} un historique (locations, dépenses ou maintenance) et ne peuvent pas être supprimées définitivement.`
          : null,
    };
  },

  // Cars have no soft-delete: this is the only way to remove one, and it's
  // guarded — a car with any history in another module (rentals, expenses,
  // maintenance) is never deletable, since none of those relations cascade
  // on purpose. CarStatus (e.g. OUT_OF_SERVICE) is how an admin takes a car
  // out of rotation without erasing it; the frontend surfaces
  // CAR_HAS_HISTORY as an explanatory alert rather than a silent failure.
  async delete(id: string, userId: string, ipAddress?: string) {
    const car = await CarsService.getById(id);
    await assertNoHistory(id);

    await prisma.$transaction(async (tx) => {
      await CarsRepository.deleteAllImages(id, tx);
      await CarsRepository.deleteById(id, tx);
      await AuditService.record(tx, {
        userId,
        action: 'CAR_HARD_DELETE',
        entityType: 'Car',
        entityId: id,
        before: car,
        ipAddress,
      });
    });

    // Same best-effort-after-commit pattern as removeImage: a leftover
    // Cloudinary asset is a harmless cost, and the DB row is already gone
    // either way by this point.
    for (const image of car.images) {
      try {
        await deleteCloudinaryImage(image.publicId);
      } catch (err) {
        console.error(`Failed to delete Cloudinary asset ${image.publicId}:`, err);
      }
    }

    return car;
  },

  async bulkDelete(ids: string[], userId: string, ipAddress?: string) {
    const cars = await Promise.all(ids.map((id) => CarsService.getById(id)));
    await Promise.all(ids.map((id) => assertNoHistory(id)));

    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        await CarsRepository.deleteAllImages(id, tx);
        await CarsRepository.deleteById(id, tx);
      }
      for (const car of cars) {
        await AuditService.record(tx, {
          userId,
          action: 'CAR_HARD_DELETE',
          entityType: 'Car',
          entityId: car.id,
          before: car,
          ipAddress,
        });
      }
    });

    for (const car of cars) {
      for (const image of car.images) {
        try {
          await deleteCloudinaryImage(image.publicId);
        } catch (err) {
          console.error(`Failed to delete Cloudinary asset ${image.publicId}:`, err);
        }
      }
    }

    return cars;
  },

  // All-or-nothing: one transaction touching every id, same guarantee as
  // updating a single car — a partial bulk failure would leave the admin
  // unsure which of their selection actually changed.
  async bulkUpdateStatus(
    ids: string[],
    status: UpdateCarInput['status'],
    userId: string,
    ipAddress?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.car.findMany({ where: { id: { in: ids } } });
      if (existing.length !== ids.length) {
        throw new AppError(404, 'CAR_NOT_FOUND', 'Une ou plusieurs voitures sont introuvables.');
      }
      if (existing.some((car) => car.status === 'RENTED')) {
        throw new AppError(
          409,
          'CAR_CURRENTLY_RENTED',
          'Une ou plusieurs voitures sélectionnées sont en cours de location. Retournez leur location pour changer leur statut.',
        );
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
    await CarsService.getById(id);
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

  async exportXlsx(query: CarExportQuery): Promise<Buffer> {
    const cars = await CarsRepository.findAllForExport(query);
    return toXlsxBuffer<Car>('Voitures', cars, [
      { header: 'Immatriculation', value: (c) => c.licensePlate, width: 16 },
      { header: 'VIN', value: (c) => c.vin, width: 20 },
      { header: 'Marque', value: (c) => c.brand, width: 14 },
      { header: 'Modèle', value: (c) => c.model, width: 14 },
      { header: 'Année', value: (c) => c.year, width: 8 },
      { header: 'Couleur', value: (c) => c.color, width: 12 },
      { header: 'Catégorie', value: (c) => CATEGORY_LABELS[c.category] ?? c.category, width: 14 },
      {
        header: 'Transmission',
        value: (c) => TRANSMISSION_LABELS[c.transmission] ?? c.transmission,
        width: 14,
      },
      { header: 'Carburant', value: (c) => FUEL_TYPE_LABELS[c.fuelType] ?? c.fuelType, width: 12 },
      { header: 'Places', value: (c) => c.seats, width: 8 },
      { header: 'Kilométrage', value: (c) => c.mileage, width: 12, numFmt: '#,##0' },
      {
        header: 'Tarif / jour (DT)',
        value: (c) => Number(c.dailyRate),
        width: 16,
        numFmt: '#,##0.000',
      },
      { header: 'Statut', value: (c) => STATUS_LABELS[c.status] ?? c.status, width: 14 },
      {
        header: "Date d'achat",
        value: (c) => c.purchaseDate,
        width: 14,
        numFmt: 'dd/mm/yyyy',
      },
      {
        header: "Prix d'achat (DT)",
        value: (c) => (c.purchasePrice ? Number(c.purchasePrice) : null),
        width: 16,
        numFmt: '#,##0.000',
      },
      {
        header: 'Expiration assurance',
        value: (c) => c.insuranceExpiryDate,
        width: 18,
        numFmt: 'dd/mm/yyyy',
      },
      {
        header: 'Expiration contrôle technique',
        value: (c) => c.technicalInspectionExpiryDate,
        width: 22,
        numFmt: 'dd/mm/yyyy',
      },
      {
        header: 'Expiration carte grise',
        value: (c) => c.registrationExpiryDate,
        width: 18,
        numFmt: 'dd/mm/yyyy',
      },
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
