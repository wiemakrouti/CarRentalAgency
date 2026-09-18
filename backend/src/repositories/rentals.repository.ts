import type { Prisma, PrismaClient, RentalStatus } from '@prisma/client';
import { prisma } from '../lib/prisma-client.js';
import { notDeleted } from './soft-delete.js';
import { overlappingRentalsFilter } from '../lib/rental-availability.js';
import { startOfDayUTC } from '../lib/date-utils.js';
import type { RentalListQuery } from '../validators/rental.validator.js';

type Db = PrismaClient | Prisma.TransactionClient;

// payments.attachments (Phase 5): damage-fee photos are most useful right
// where the damage was recorded — a rental's own detail view — not just in
// the standalone Finances payments list.
//
// payments.where excludes archived rows (same notDeleted default every
// other Payment reader uses — Finances' own list/stats never surface them
// either) — without it, an archived payment kept showing up embedded on
// the rental (and getting counted in its balance) even after "Archiver".
const RENTAL_INCLUDE = {
  car: true,
  client: true,
  extensions: true,
  payments: { where: notDeleted({}), include: { attachments: true } },
} as const;

function buildWhere(agencyId: string, query: RentalListQuery): Prisma.RentalWhereInput {
  const where = notDeleted<Prisma.RentalWhereInput>(
    {
      agencyId,
      carId: query.carId,
      clientId: query.clientId,
    },
    { includeArchived: query.includeArchived },
  );

  // pickupOverdue takes priority over `status`: it narrows RESERVED further
  // than any RentalStatus value can ("pickup overdue" isn't its own status,
  // see the validator's own comment) — the KPI header's "Départs en
  // retard"/"Réservations à venir" tiles link here without also needing to
  // agree on a matching `status` value.
  //
  // Compared against the start of today, not the exact instant `new Date()`
  // — a pickup/return scheduled for today hasn't actually been missed until
  // today is over, so comparing against `now` instead flagged it "en retard"
  // the moment any hour past midnight ticked by (rental-calendar.ts's
  // getEffectiveRentalStatus mirrors this same boundary on the frontend).
  // startOfDayUTC, not startOfToday's server-local midnight: pickupDate/
  // plannedReturnDate are UTC-midnight of a calendar day, and a local cutoff
  // would silently disagree with them by the server's own UTC offset.
  const today = startOfDayUTC(new Date());
  if (query.pickupOverdue !== undefined) {
    where.status = 'RESERVED';
    where.pickupDate = query.pickupOverdue ? { lt: today } : { gte: today };
  } else if (query.status === 'OVERDUE') {
    // OVERDUE is never actually written to Rental.status (see the enum's own
    // comment in schema.prisma) — it's ACTIVE + plannedReturnDate in the
    // past, computed read-side everywhere else in the app
    // (rental-calendar.ts's getEffectiveRentalStatus). A plain `status:
    // 'OVERDUE'` equality filter would always match zero rows; split ACTIVE
    // by date instead so both filter options actually work.
    where.status = 'ACTIVE';
    where.plannedReturnDate = { lt: today };
  } else if (query.status === 'ACTIVE') {
    where.status = 'ACTIVE';
    where.plannedReturnDate = { gte: today };
  } else if (query.status) {
    where.status = query.status;
  }

  // Merged onto whatever pickupDate constraint the branches above already
  // set (pickupOverdue/OVERDUE own it too, for their own narrower purpose) —
  // no real caller combines both, so this just layers gte/lte on top rather
  // than guarding against a combination nobody sends.
  if (query.pickupFrom || query.pickupTo) {
    where.pickupDate = {
      ...(typeof where.pickupDate === 'object' && where.pickupDate ? where.pickupDate : {}),
      ...(query.pickupFrom ? { gte: query.pickupFrom } : {}),
      ...(query.pickupTo ? { lte: query.pickupTo } : {}),
    };
  }

  if (query.search) {
    where.OR = [
      { rentalNumber: { contains: query.search, mode: 'insensitive' } },
      { car: { brand: { contains: query.search, mode: 'insensitive' } } },
      { car: { model: { contains: query.search, mode: 'insensitive' } } },
      { car: { licensePlate: { contains: query.search, mode: 'insensitive' } } },
      { client: { firstName: { contains: query.search, mode: 'insensitive' } } },
      { client: { lastName: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  return where;
}

export const RentalsRepository = {
  async findMany(agencyId: string, query: RentalListQuery, db: Db = prisma) {
    const where = buildWhere(agencyId, query);
    const [items, total] = await Promise.all([
      db.rental.findMany({
        where,
        include: RENTAL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.rental.count({ where }),
    ]);
    return { items, total };
  },

  findById(agencyId: string, id: string, options?: { includeArchived?: boolean }, db: Db = prisma) {
    return db.rental.findFirst({
      where: notDeleted({ id, agencyId }, options),
      include: RENTAL_INCLUDE,
    });
  },

  // A RESERVED rental whose plannedReturnDate has already passed — not just
  // the pickupDate — means the *entire* originally-booked window is in the
  // past: the client never showed up at all, not "running a bit late". Feeds
  // RentalsService.sweepExpiredReservations, which auto-cancels these rather
  // than let "jours de retard" grow without bound on a reservation nobody
  // will ever activate.
  findExpiredReservations(agencyId: string, now: Date, db: Db = prisma) {
    return db.rental.findMany({
      where: { agencyId, status: 'RESERVED', deletedAt: null, plannedReturnDate: { lt: now } },
      include: RENTAL_INCLUDE,
    });
  },

  cancelExpiredReservations(ids: string[], reason: string, db: Db = prisma) {
    if (ids.length === 0) return Promise.resolve({ count: 0 });
    // status: 'RESERVED' re-checked here too (not just by the caller's
    // findExpiredReservations query) so a concurrent activate()/cancel() on
    // one of these ids between the find and this update can't get silently
    // overwritten back to CANCELLED.
    return db.rental.updateMany({
      where: { id: { in: ids }, status: 'RESERVED' },
      data: { status: 'CANCELLED', cancelledReason: reason },
    });
  },

  hasOverlap(
    carId: string,
    params: { pickupDate: Date; returnDate: Date; excludeRentalId?: string },
    db: Db = prisma,
  ) {
    return db.rental.findFirst({
      where: { carId, ...overlappingRentalsFilter(params) },
    });
  },

  create(data: Prisma.RentalUncheckedCreateInput, db: Db = prisma) {
    return db.rental.create({ data, include: RENTAL_INCLUDE });
  },

  // Atomic guard against invalid-state transitions and races: the WHERE
  // clause re-checks status at the DB row level, so two concurrent requests
  // racing on the same rental can never both succeed. Caller must re-fetch
  // via findById if it needs the updated record.
  async updateGuarded(
    id: string,
    expectedStatuses: readonly RentalStatus[],
    data: Prisma.RentalUncheckedUpdateManyInput,
    db: Db = prisma,
  ): Promise<boolean> {
    const result = await db.rental.updateMany({
      where: { id, status: { in: [...expectedStatuses] }, deletedAt: null },
      data,
    });
    return result.count === 1;
  },

  // Four independent counts for the Rentals page's KPI header — each
  // mirrors a distinction RemindersService already draws (ACTIVE vs.
  // overdue-return, RESERVED vs. overdue-pickup), just as a count instead
  // of the full row set. Plain `count()` queries, not a shared "list
  // overdue rentals" helper: the header only ever needs the number.
  async getSummaryCounts(agencyId: string, db: Db = prisma) {
    // Start of today, not `now` — see buildWhere's own comment above: a
    // pickup/return due today isn't overdue until today is actually over.
    // startOfDayUTC, not startOfToday's server-local midnight — same reason
    // as buildWhere's own `today` above.
    const today = startOfDayUTC(new Date());
    const [active, overdueReturn, overduePickup, upcomingReservations] = await Promise.all([
      db.rental.count({
        where: { agencyId, status: 'ACTIVE', deletedAt: null, plannedReturnDate: { gte: today } },
      }),
      db.rental.count({
        where: { agencyId, status: 'ACTIVE', deletedAt: null, plannedReturnDate: { lt: today } },
      }),
      db.rental.count({
        where: { agencyId, status: 'RESERVED', deletedAt: null, pickupDate: { lt: today } },
      }),
      db.rental.count({
        where: { agencyId, status: 'RESERVED', deletedAt: null, pickupDate: { gte: today } },
      }),
    ]);
    return { active, overdueReturn, overduePickup, upcomingReservations };
  },

  // Candidate rentals for the occupancy heatmap (RentalsService.getOccupancy)
  // — every rental whose car was actually out at some point that could
  // overlap [from, to] (both ends inclusive: the service's day-by-day loop
  // gives `to` itself a bucket, most commonly "today"). RESERVED is excluded
  // (the car never left) and so is CANCELLED (never happened); only
  // ACTIVE/COMPLETED ever really occupied a day. `actualReturnDate: null`
  // covers ACTIVE rentals still ongoing — plannedReturnDate is never used as
  // their end here since an overdue return means it's already in the past
  // while the car is still out.
  // Day-by-day bucketing happens in the service, not here: Prisma has no
  // clean way to "count per calendar day over a range" without raw SQL.
  //
  // pickupDate uses `lte`, not `lt`: a rental picked up exactly on `to`
  // (e.g. a car collected earlier today) must still be a candidate, or it
  // silently vanishes from that day's count — the day-bucketing loop below
  // already treats `to` as inclusive, so the candidate filter has to agree.
  findOccupancyRentals(agencyId: string, from: Date, to: Date, db: Db = prisma) {
    return db.rental.findMany({
      where: {
        agencyId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        pickupDate: { lte: to },
        OR: [{ actualReturnDate: null }, { actualReturnDate: { gt: from } }],
      },
      select: { pickupDate: true, actualReturnDate: true },
    });
  },

  // Not status-guarded like the lifecycle transitions above: a deposit can
  // legitimately be handed back at any point after it was collected, so
  // there's no single expected Rental.status to check against. Called from
  // PaymentsService.create inside the same transaction as the
  // DEPOSIT_REFUND payment row (Phase 5 business rule).
  markDepositReturned(id: string, db: Db = prisma) {
    return db.rental.update({ where: { id }, data: { depositReturned: true } });
  },
};
