// One-off data repair for rentals created through "Location immédiate" with a
// *future* pickup date, before that was blocked (commit b304886). Those were
// created straight as ACTIVE with their car flipped to RENTED weeks early —
// so they show "en cours" before their date and hide the car from every
// other booking. This puts them back where a "Réservation à l'avance" would
// have left them: rental RESERVED (handover fields cleared, to be filled by
// a normal activation on the day), car AVAILABLE.
//
// Dry run by default — only lists what it would change. Run it on the VPS,
// after a fresh backup (~/backup-db.sh), from /home/ubuntu/app:
//
//   docker compose -f docker-compose.prod.yml exec backend node dist/scripts/revert-premature-activations.js
//   docker compose -f docker-compose.prod.yml exec backend node dist/scripts/revert-premature-activations.js --apply
//
// Safe to re-run: every write is guarded on the expected current status, so
// a rental already fixed (or activated/returned meanwhile) is skipped.
import { prisma } from '../lib/prisma-client.js';
import { endOfDayExclusive, formatDateOnly, startOfDayUTC, agencyDay } from '../lib/date-utils.js';
import { RentalsRepository } from '../repositories/rentals.repository.js';
import { CarsRepository } from '../repositories/cars.repository.js';
import { AuditService } from '../services/audit.service.js';

const apply = process.argv.includes('--apply');

const RENTAL_SELECT = {
  id: true,
  rentalNumber: true,
  agencyId: true,
  carId: true,
  status: true,
  pickupDate: true,
  plannedReturnDate: true,
  mileageAtPickup: true,
  fuelLevelAtPickup: true,
  createdAt: true,
  car: { select: { licensePlate: true, brand: true, model: true, status: true } },
  client: { select: { firstName: true, lastName: true } },
  payments: { select: { amount: true, type: true, status: true } },
} as const;

type Row = Awaited<ReturnType<typeof findActive>>[number];

function findActive() {
  return prisma.rental.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: RENTAL_SELECT,
    orderBy: { pickupDate: 'asc' },
  });
}

function describe(rental: Row): string {
  const payments = rental.payments.length
    ? rental.payments.map((p) => `${p.type} ${Number(p.amount)} DT (${p.status})`).join(', ')
    : 'aucun';
  return [
    `  ${rental.rentalNumber}`,
    `    Voiture  : ${rental.car.brand} ${rental.car.model} (${rental.car.licensePlate}) — statut ${rental.car.status}`,
    `    Client   : ${rental.client.firstName} ${rental.client.lastName}`,
    `    Dates    : ${formatDateOnly(rental.pickupDate)} → ${formatDateOnly(rental.plannedReturnDate)}` +
      ` (créée le ${formatDateOnly(agencyDay(rental.createdAt))})`,
    `    Paiements: ${payments} — conservés tels quels`,
  ].join('\n');
}

// A rental activated the normal way has pickupDate = the exact handover
// instant (activate() sets it to `now`). One created through "Location
// immédiate" keeps the date-only value from the form (UTC midnight). If that
// date is after the day it was created, the handover was booked ahead of time.
function wasActivatedAheadOfTime(rental: Row): boolean {
  const isDateOnly = rental.pickupDate.getTime() === startOfDayUTC(rental.pickupDate).getTime();
  return isDateOnly && rental.pickupDate > agencyDay(rental.createdAt);
}

async function revert(rental: Row): Promise<'reverted' | 'skipped'> {
  return prisma.$transaction(async (tx) => {
    const rentalReverted = await RentalsRepository.updateGuarded(
      rental.id,
      ['ACTIVE'],
      { status: 'RESERVED', mileageAtPickup: null, fuelLevelAtPickup: null },
      tx,
    );
    if (!rentalReverted) return 'skipped';

    // Only free the car if no other rental is genuinely out with it.
    const stillOut = await tx.rental.count({
      where: { carId: rental.carId, status: 'ACTIVE', deletedAt: null },
    });
    if (stillOut === 0) {
      await CarsRepository.updateStatusGuarded(rental.carId, ['RENTED'], { status: 'AVAILABLE' }, tx);
    }

    const before = {
      id: rental.id,
      rentalNumber: rental.rentalNumber,
      carId: rental.carId,
      status: rental.status,
      pickupDate: rental.pickupDate,
      plannedReturnDate: rental.plannedReturnDate,
      mileageAtPickup: rental.mileageAtPickup,
      fuelLevelAtPickup: rental.fuelLevelAtPickup,
    };
    await AuditService.record(tx, {
      userId: null,
      action: 'RENTAL_REVERT_ACTIVATION',
      entityType: 'Rental',
      entityId: rental.id,
      before,
      after: { ...before, status: 'RESERVED', mileageAtPickup: null, fuelLevelAtPickup: null },
    });
    return 'reverted';
  });
}

async function main() {
  const today = agencyDay();
  const active = await findActive();

  // Pickup still in the future: unambiguous, nobody can have the car yet.
  const toRevert = active.filter((r) => r.pickupDate >= endOfDayExclusive(today));
  // Same origin, but the date has arrived since — the client may really have
  // taken the car by now, so only the admin can tell. Reported, not changed.
  const toCheck = active.filter((r) => r.pickupDate < endOfDayExclusive(today) && wasActivatedAheadOfTime(r));

  console.log(`Aujourd'hui (Tunis) : ${formatDateOnly(today)}`);
  console.log(`Mode : ${apply ? 'APPLICATION' : 'simulation (rien n\'est modifié, ajoutez --apply pour corriger)'}\n`);

  console.log(`Locations "en cours" dont la date n'est pas encore arrivée : ${toRevert.length}`);
  toRevert.forEach((r) => console.log(describe(r)));

  if (toCheck.length) {
    console.log(`\nÀ vérifier manuellement (créées en avance, date désormais arrivée) : ${toCheck.length}`);
    console.log('  Non modifiées : si le client n\'a pas encore pris la voiture, signalez-les.');
    toCheck.forEach((r) => console.log(describe(r)));
  }

  if (!apply || toRevert.length === 0) return;

  console.log('\nCorrection…');
  for (const rental of toRevert) {
    const result = await revert(rental);
    console.log(`  ${rental.rentalNumber} : ${result === 'reverted' ? 'remise en "Réservée"' : 'ignorée (statut modifié entre-temps)'}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
