# Database

PostgreSQL via Prisma. Schema: `backend/prisma/schema.prisma` (source of truth for the DB — keep this doc in sync when it changes, don't let them drift). Enum values also live in `packages/shared/src/enums.ts` for frontend/shared use — the two must match by hand (Prisma's schema DSL can't import TS).

Money fields use `Decimal(10,3)` — TND (Tunisian Dinar) has 3 decimal places (millimes).

## Entities

| Model | Purpose |
|---|---|
| `User` | Single admin today; `role` field ready for future multi-user |
| `Car` | Fleet vehicle; `CarImage` (1–N) for photos |
| `Client` | Renter; `ClientDocument` (1–N) for ID/license scans |
| `Rental` | Core entity — the "Locations" module. Owns pickup/return dates, snapshotted `dailyRate`/`totalAmount`, deposit, status lifecycle |
| `RentalExtension` | Audit trail of "extend rental" (1–N from `Rental`) |
| `Payment` | Ledger entry per rental (deposit, balance, late fee, damage fee, refund); `PaymentAttachment` (1–N) for damage photos |
| `Expense` | Agency-wide or car-specific cost, `carId` nullable |
| `MaintenanceRecord` | Per-car service history + `nextDueDate`/`nextDueMileage` |
| `Setting` | Singleton row: agency profile, currency, contract languages, deposit default, tax rate |
| `AuditLog` | Who did what, when, before/after — see `docs/architecture.md` |
| `RefreshToken` | One row per login session/device — see "Authentication" below |

## Soft delete

`deletedAt DateTime?` on Car, Client, Rental, Payment, Expense, MaintenanceRecord. `Car.licensePlate`, `Car.vin`, `Client.email` are only unique **among non-archived rows** — enforced via partial unique indexes added by hand to the initial migration's SQL (Prisma's schema DSL has no partial-unique-index syntax):

```sql
CREATE UNIQUE INDEX "cars_license_plate_active_key" ON "cars"("licensePlate") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "cars_vin_active_key" ON "cars"("vin") WHERE "deletedAt" IS NULL AND "vin" IS NOT NULL;
CREATE UNIQUE INDEX "clients_email_active_key" ON "clients"("email") WHERE "deletedAt" IS NULL AND "email" IS NOT NULL;
```

## Authentication

`RefreshToken` is stateful by design (not a self-contained JWT): the access token is a short-lived JWT (15m, `JWT_ACCESS_SECRET`), verified by signature only; the refresh token is a random opaque value, hashed (SHA-256, not bcrypt — the token is already high-entropy so a slow KDF buys nothing) and stored as `RefreshToken.tokenHash`. One row per session/device — logging in on a second device doesn't touch the first device's row.

- **Login** creates a new row.
- **Refresh rotates**: the presented row is marked `revokedAt` and linked to its replacement via `replacedByTokenId`; a *new* row is created and its raw token sent back in the cookie. The old row's raw value is worthless afterward (only its hash was ever stored, and it's now flagged revoked).
- **Reuse of a revoked token is treated as theft** — the refresh endpoint responds by revoking every other active row for that user, forcing all sessions to re-login.
- **Logout** deletes the current row outright (a session record, not a business entity — the soft-delete policy below doesn't apply to it).
- **Cleanup**: expired/revoked rows are not deleted on read; a future scheduled job prunes them (`RefreshTokenRepository` exposes the query already, see `backend/src/repositories/refresh-token.repository.ts`).

## Key design decisions

- **`Rental.dailyRate`/`totalAmount` are snapshotted**, not read live from `Car.dailyRate` — a later price change never retroactively alters a historical contract.
- **`RentalStatus.OVERDUE`** is not flipped by a background job (no scheduler in v1). It's set by the return flow when a rental comes back late; read-side queries (dashboard) treat `ACTIVE` + past `plannedReturnDate` as overdue for display/counting.
- **`Payment` is normalized under `Rental`**, not a flat `amountPaid` field — a rental can have multiple payment events with different methods and types.
- **`Expense.carId` is nullable** — not every agency expense is car-specific.

## Indexes

- Unique: `User.email`, `Rental.rentalNumber`, `ContractDocument.rentalId`.
- `Rental.status`, `Rental(carId, pickupDate, plannedReturnDate)` — the composite index that makes the availability-overlap check fast.
- `Car.status`, `Car.licensePlate`, `Client.email`, `Client.phone`, `Payment.type`, `Expense.date`, `MaintenanceRecord.carId`, `AuditLog(entityType, entityId)`, `AuditLog(userId, createdAt)`.
- `deletedAt` indexed on every soft-deletable model (list queries filter on it constantly).

## Migrations

`npm run prisma:migrate --workspace backend` (dev) / `prisma migrate deploy` (prod, run via Docker entrypoint or manually before `backend` starts). Seed: `npm run seed --workspace backend` (see `backend/prisma/seed.ts`).
