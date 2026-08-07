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
- **Cars** — `GET/POST /cars`, `GET/PATCH/DELETE /cars/:id`, `POST /cars/:id/restore`, `GET /cars/available?pickupDate=&returnDate=`, `POST /cars/:id/images` (multipart, field `image` + optional `isPrimary`), `DELETE /cars/:id/images/:imageId`, `POST /cars/:id/images/:imageId/primary`. Duplicate `licensePlate` (among non-archived cars) → `409 DUPLICATE_LICENSE_PLATE`. Image uploads: 5MB max, JPEG/PNG/WebP only, stored via Cloudinary — a missing Cloudinary config fails fast with `503 IMAGE_STORAGE_NOT_CONFIGURED` rather than an opaque SDK error.
- **Clients** — `GET/POST /clients`, `GET/PATCH/DELETE /clients/:id`, `POST /clients/:id/restore`, `POST /clients/:id/documents` (multipart, field `document` + `type` + optional `expiryDate`), `DELETE /clients/:id/documents/:documentId`. Duplicate `email` (among non-archived clients) → `409 DUPLICATE_EMAIL`. Same image constraints as Cars (5MB, JPEG/PNG/WebP) via the same shared upload middleware. List supports `?blacklisted=true|false` (boolean query params go through `booleanQueryParam()` in `packages/shared` — plain `z.coerce.boolean()` treats the string `"false"` as truthy, a real bug caught while building this filter).
- **Rentals** — `GET /rentals`, `GET /rentals/:id`, `POST /rentals`. Creation validates the car is `status: AVAILABLE` *and* has no date-overlapping `RESERVED`/`ACTIVE` rental (shared overlap definition in `backend/src/lib/rental-availability.ts`, also used by `/cars/available`) → both failure modes return `409 CAR_NOT_AVAILABLE` with a message describing which. `totalAmount` = the car's current `dailyRate` × nights, snapshotted onto the rental (never re-read from `Car` later). `depositAmount` defaults from the `Setting` singleton unless the request overrides it. `rentalNumber` is server-generated (`LOC-YYYYMMDD-XXXX`), retried up to 5 times on the practically-impossible unique-constraint collision. Blacklisted clients are **not** blocked from renting (informational only, by explicit decision — may change later). List/get responses include `extensions` and `payments` (Phase 4b) alongside `car`/`client`.

  **Lifecycle (Phase 4b)** — `POST /rentals/:id/activate`, `POST /rentals/:id/return`, `POST /rentals/:id/extend`, `POST /rentals/:id/cancel`. Every transition is guarded atomically at the DB row level (`updateMany({ where: { id, status: <expected> } })`, checking `count === 1`) so a stale read can never win a race against a concurrent request; activate/return/extend additionally run under Postgres `Serializable` isolation as a backstop against write-skew (e.g. two concurrent extends of overlapping ranges). Each transition is one atomic transaction covering the Rental update, any `Car` status/mileage sync, any `Payment`/`RentalExtension` row, and the `AuditLog` entry.
    - `POST /rentals/:id/activate` — `RESERVED` → `ACTIVE` only. Body: `mileageAtPickup`, `fuelLevelAtPickup` (both required). Also flips `Car.status` `AVAILABLE` → `RENTED` (guarded the same way — `409 CAR_NOT_AVAILABLE` if the car isn't actually available).
    - `POST /rentals/:id/return` — `ACTIVE` → `COMPLETED` only. Body: `mileageAtReturn`, `fuelLevelAtReturn` (both required, `mileageAtReturn` must be ≥ `mileageAtPickup` → `400 INVALID_MILEAGE`), optional `damageFeeAmount`/`damageFeeNotes`. Flips `Car.status` back to `AVAILABLE` and syncs `Car.mileage` to `mileageAtReturn`. Auto-computes a `LATE_FEE` payment when returned past `plannedReturnDate` (`lateDays × dailyRate`, `lateDays = ceil((now - plannedReturnDate) / 1 day)`); a `damageFeeAmount` creates a `DAMAGE_FEE` payment. Both auto-generated payments are written `method: CASH, status: PENDING` — placeholders until Phase 5 gives the admin a real payment-collection UI to correct/settle them.
    - `POST /rentals/:id/extend` — `ACTIVE` only, body `newReturnDate` (must be after the current `plannedReturnDate` → `400 INVALID_EXTENSION_DATE`). Re-checks the car has no other overlapping `RESERVED`/`ACTIVE` rental for the new range (excluding itself) → `409 CAR_NOT_AVAILABLE`. Creates a `RentalExtension` row (`previousReturnDate`/`newReturnDate`/`additionalAmount`) and an `EXTENSION_PAYMENT` (`additionalNights × dailyRate`, same `CASH`/`PENDING` placeholder convention), and increments `Rental.totalAmount`.
    - `POST /rentals/:id/cancel` — `RESERVED` only. Body: optional `cancelledReason`. Never touches `Car` — a `RESERVED` rental never marked the car `RENTED`.
    - `OVERDUE` is never written by any of these — it's a purely computed, read-side condition (`status: ACTIVE` + `plannedReturnDate` in the past).

Planned (see `docs/roadmap.md` for the phase each ships in):

**Rentals (contract PDF — Phase 4c)** — `GET /rentals/:id/contract`

**Finances** — `GET/POST /finances/payments`, `POST/DELETE /finances/payments/:id/attachments(/:attachmentId)`, `GET/POST /finances/expenses`, `PATCH/DELETE /finances/expenses/:id`, `GET /finances/summary?from=&to=`

**Maintenance** — `GET/POST /maintenance`, `GET/PATCH/DELETE /maintenance/:id`, `GET /cars/:id/maintenance`

**Reports** — `GET /reports/dashboard`, `GET /reports/revenue?period=`, `GET /reports/fleet-utilization`, `GET /reports/export?type=pdf|csv`

**Settings** — `GET/PATCH /settings`

**Audit** — `GET /audit-logs?entityType=&entityId=&userId=&from=&to=` (admin-only, paginated)
