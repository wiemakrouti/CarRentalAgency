# API

REST, JSON, prefixed `/api/v1`. All routes except `/auth/login` and `/auth/refresh` require `Authorization: Bearer <accessToken>` (see `backend/src/middleware/authenticate.ts`).

## Authentication

Access token: short-lived JWT (`JWT_ACCESS_EXPIRES_IN`, default 15m), returned in the login/refresh response body, sent as `Authorization: Bearer <token>`. Refresh token: stateful, opaque, delivered as an httpOnly cookie scoped to path `/api/v1/auth` — see `docs/database.md` "Authentication" for the rotation/reuse-detection design (`RefreshToken` table). No lockout/rate-limiting on `/auth/login` yet — deferred to the Phase 10 hardening pass (`docs/roadmap.md`). Login failures (unknown email or wrong password) return the same generic `INVALID_CREDENTIALS` error, deliberately, to avoid user enumeration.

## Response envelope

Defined in `packages/shared/src/api-envelope.ts`, used by every endpoint:

```ts
// success
{ success: true, data: T, meta?: { page, pageSize, total } }
// error
{ success: false, error: { code: string, message: string } }
```

Errors never leak stack traces or Prisma internals (`backend/src/middleware/error-handler.ts`) — unknown errors are logged server-side and returned as a generic message.

## Conventions

- `DELETE /*` performs a **soft delete** and returns `200` with the archived record, not `204`.
- List endpoints exclude archived records by default; `?includeArchived=true` opts in.
- `POST .../restore` un-archives a soft-deleted record.
- Every request body/query is validated by a Zod schema (`validate(schema)` middleware) before it reaches a controller.
- List endpoints accept `page`/`pageSize` (see `packages/shared/src/schemas/pagination.schema.ts`).

## Endpoints (filled in per module as each phase ships)

Implemented:
- `GET /health` — liveness check, no auth required.
- **Auth** — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` (see "Authentication" above).
- **Cars** — `GET/POST /cars`, `GET/PATCH/DELETE /cars/:id`, `POST /cars/:id/restore`, `GET /cars/available?pickupDate=&returnDate=`, `POST /cars/:id/images` (multipart, field `image` + optional `isPrimary`), `DELETE /cars/:id/images/:imageId`, `POST /cars/:id/images/:imageId/primary`. Duplicate `licensePlate` (among non-archived cars) → `409 DUPLICATE_LICENSE_PLATE`. Image uploads: 5MB max, JPEG/PNG/WebP only, stored via Cloudinary — a missing Cloudinary config fails fast with `503 IMAGE_STORAGE_NOT_CONFIGURED` rather than an opaque SDK error. `GET /cars`/`GET /cars/export` also accept `sortBy` (`brand`/`licensePlate`/`category`/`status`/`dailyRate`/`year`/`mileage`/`createdAt`, default `createdAt`), `sortOrder` (`asc`/`desc`), and range filters `min|maxDailyRate`, `min|maxYear`, `min|maxMileage`. List/detail responses include `activeRental: { plannedReturnDate } | null` — populated only while `status: RENTED`, sourced from that car's current `ACTIVE`/`OVERDUE` rental.
  - `GET /cars/:id/stats` — `{ totalRentals, completedRentals, totalRevenue, lastRentalDate }` for the Cars detail panel; `totalRevenue` sums `COMPLETED` payments for the car's rentals (same definition as Finances' summary), not contracted `totalAmount`.
  - `GET /cars/export` — same filters as `GET /cars` (minus pagination), streams every matching row as `text/csv` (semicolon-delimited, UTF-8 BOM for Excel).
  - `POST /cars/bulk/archive` (body `{ ids: string[] }`) and `PATCH /cars/bulk/status` (body `{ ids: string[], status }`) — bulk variants of archive/update, one atomic transaction per call, one `AuditLog` entry per car. `404 CAR_NOT_FOUND` if any id doesn't resolve to a non-archived car (all-or-nothing, nothing is changed).
- **Clients** — `GET/POST /clients`, `GET/PATCH/DELETE /clients/:id`, `POST /clients/:id/restore`, `POST /clients/:id/documents` (multipart, field `document` + `type` + optional `expiryDate`), `DELETE /clients/:id/documents/:documentId`. Duplicate `email` (among non-archived clients) → `409 DUPLICATE_EMAIL`. Same image constraints as Cars (5MB, JPEG/PNG/WebP) via the same shared upload middleware. List supports `?blacklisted=true|false` (boolean query params go through `booleanQueryParam()` in `packages/shared` — plain `z.coerce.boolean()` treats the string `"false"` as truthy, a real bug caught while building this filter).
- **Rentals** — `GET /rentals`, `GET /rentals/:id`, `POST /rentals`. Creation validates the car is `status: AVAILABLE` *and* has no date-overlapping `RESERVED`/`ACTIVE` rental (shared overlap definition in `backend/src/lib/rental-availability.ts`, also used by `/cars/available`) → both failure modes return `409 CAR_NOT_AVAILABLE` with a message describing which. `totalAmount` = the car's current `dailyRate` × nights, snapshotted onto the rental (never re-read from `Car` later). `depositAmount` defaults from the `Setting` singleton unless the request overrides it. `rentalNumber` is server-generated (`LOC-YYYYMMDD-XXXX`), retried up to 5 times on the practically-impossible unique-constraint collision. Blacklisted clients are **not** blocked from renting (informational only, by explicit decision — may change later). List/get responses include `extensions` and `payments` (Phase 4b) alongside `car`/`client`.

  **Lifecycle (Phase 4b)** — `POST /rentals/:id/activate`, `POST /rentals/:id/return`, `POST /rentals/:id/extend`, `POST /rentals/:id/cancel`. Every transition is guarded atomically at the DB row level (`updateMany({ where: { id, status: <expected> } })`, checking `count === 1`) so a stale read can never win a race against a concurrent request; activate/return/extend additionally run under Postgres `Serializable` isolation as a backstop against write-skew (e.g. two concurrent extends of overlapping ranges). Each transition is one atomic transaction covering the Rental update, any `Car` status/mileage sync, any `Payment`/`RentalExtension` row, and the `AuditLog` entry.
    - `POST /rentals/:id/activate` — `RESERVED` → `ACTIVE` only. Body: `mileageAtPickup`, `fuelLevelAtPickup` (both required). Also flips `Car.status` `AVAILABLE` → `RENTED` (guarded the same way — `409 CAR_NOT_AVAILABLE` if the car isn't actually available).
    - `POST /rentals/:id/return` — `ACTIVE` → `COMPLETED` only. Body: `mileageAtReturn`, `fuelLevelAtReturn` (both required, `mileageAtReturn` must be ≥ `mileageAtPickup` → `400 INVALID_MILEAGE`), optional `damageFeeAmount`/`damageFeeNotes`. Flips `Car.status` back to `AVAILABLE` and syncs `Car.mileage` to `mileageAtReturn`. Auto-computes a `LATE_FEE` payment when returned past `plannedReturnDate` (`lateDays × dailyRate`, `lateDays = ceil((now - plannedReturnDate) / 1 day)`); a `damageFeeAmount` creates a `DAMAGE_FEE` payment. Both auto-generated payments are written `method: CASH, status: PENDING` — placeholders until Phase 5 gives the admin a real payment-collection UI to correct/settle them.
    - `POST /rentals/:id/extend` — `ACTIVE` only, body `newReturnDate` (must be after the current `plannedReturnDate` → `400 INVALID_EXTENSION_DATE`). Re-checks the car has no other overlapping `RESERVED`/`ACTIVE` rental for the new range (excluding itself) → `409 CAR_NOT_AVAILABLE`. Creates a `RentalExtension` row (`previousReturnDate`/`newReturnDate`/`additionalAmount`) and an `EXTENSION_PAYMENT` (`additionalNights × dailyRate`, same `CASH`/`PENDING` placeholder convention), and increments `Rental.totalAmount`.
    - `POST /rentals/:id/cancel` — `RESERVED` only. Body: optional `cancelledReason`. Never touches `Car` — a `RESERVED` rental never marked the car `RENTED`.
    - `OVERDUE` is never written by any of these — it's a purely computed, read-side condition (`status: ACTIVE` + `plannedReturnDate` in the past).

- **Finances (Phase 5)** — `GET/POST /finances/payments`, `GET/PATCH/DELETE /finances/payments/:id`, `POST /finances/payments/:id/restore`, `POST/DELETE /finances/payments/:id/attachments(/:attachmentId)`, `GET/POST /finances/expenses`, `GET/PATCH/DELETE /finances/expenses/:id`, `POST /finances/expenses/:id/restore`, `GET /finances/summary?from=&to=`.

  **Payments** — `POST /finances/payments` records a payment already collected (cash/card/bank transfer/check): it's always written `status: COMPLETED` — `status` isn't client-settable on create — with `paidAt` defaulting to now if omitted. This is how the admin settles the `PENDING` `CASH`-placeholder rows Rentals auto-generates for `LATE_FEE`/`DAMAGE_FEE`/`EXTENSION_PAYMENT` (Phase 4b): `PATCH /finances/payments/:id` corrects amount/method/status/paidAt/notes on the existing row — `type` is immutable, since it's what the payment *is* (e.g. it drives the `DEPOSIT_REFUND` rule below), not a correctable detail. A `type: DEPOSIT_REFUND` payment atomically sets `Rental.depositReturned = true` in the same transaction — the payment record is the single source of truth for "was the deposit given back", instead of a separate manual toggle that could drift from it. List/get responses embed `rental: { car, client }` (Finances shows payments across every rental, unlike Rentals' own nested `payments[]` which already sits under its rental and only embeds `attachments`). Soft-deletable like every other module (`DELETE` archives, `POST .../restore` un-archives).

  **Payment attachments** — 1–N Cloudinary photos per payment (used in practice for `DAMAGE_FEE`), via `POST /finances/payments/:id/attachments` (multipart, field `attachment`) / `DELETE .../attachments/:attachmentId`. Same 5MB JPEG/PNG/WebP constraints and `503 IMAGE_STORAGE_NOT_CONFIGURED` fallback as Cars/Clients uploads. A rental's own `GET /rentals/:id` also embeds each payment's `attachments[]`, so damage photos show up right where the damage was recorded, not only in the standalone Finances list.

  **Expenses** — plain CRUD (`category`, `amount`, optional `carId` for a per-vehicle expense vs. a general agency expense, `description`, `date`, optional `receiptUrl` — a URL field, not a Cloudinary upload). Soft-deletable with the same archive/restore convention.

  **Summary** — `GET /finances/summary?from=&to=` returns `{ period, revenue: { total, byType }, expenses: { total, byCategory }, pendingTotal, net }`. `byType`/`byCategory` are zero-filled for every `PaymentType`/`ExpenseCategory`, not just the ones with rows in range, so the frontend never special-cases "no data yet". Revenue/pending are bounded by `Payment.createdAt` (uniform across every status, since `paidAt` is null until a `PENDING` row is settled); expenses are bounded by `Expense.date` (the business date it was incurred, not `createdAt`).

Planned (see `docs/roadmap.md` for the phase each ships in):

**Rentals (contract PDF — Phase 4c)** — `GET /rentals/:id/contract`

**Maintenance** — `GET/POST /maintenance`, `GET/PATCH/DELETE /maintenance/:id`, `GET /cars/:id/maintenance`

**Reports** — `GET /reports/dashboard`, `GET /reports/revenue?period=`, `GET /reports/fleet-utilization`, `GET /reports/export?type=pdf|csv`

**Settings** — `GET/PATCH /settings`

**Audit** — `GET /audit-logs?entityType=&entityId=&userId=&from=&to=` (admin-only, paginated)
