# Architecture

Internal admin dashboard for a single French-speaking car rental agency (not SaaS, single administrator). Naming convention: **English in all code** (folders, files, DB, API, variables), **French in the UI only**.

## System overview

```
Client (React SPA)  --HTTP/JSON-->  API (Express)  -->  Prisma  -->  PostgreSQL
                                          |
                                          --> Cloudinary (images/documents)
                                          --> Puppeteer (HTML -> PDF contracts)
```

## Backend layering

`Routes → Controllers → Services → Repositories → Prisma`, plus cross-cutting `Middleware` and `Validators`.

- **Routes** — wire HTTP verb+path to a controller. No logic.
- **Controllers** — parse/validate request, call a service, shape the HTTP response. No business logic.
- **Services** — all business logic (pricing, availability overlap checks, late fees). Framework-agnostic, unit-testable.
- **Repositories** — the only layer that talks to Prisma. Soft-delete-aware by default (see `backend/src/repositories/soft-delete.ts`).
- **Middleware** — `authenticate` (JWT verify), `authorize(...roles)` (role-ready, one role today), `errorHandler` (never leaks internals), `validate(schema)`.

## Audit logging

`AuditService.record(...)` (`backend/src/services/audit.service.ts`) is called **explicitly** from inside each mutating service method — login/logout, create/update/delete/restore, rental activate/return/extend/cancel, settings changes — in the same Prisma transaction as the business write. Explicit calls (not generic middleware) because a generic "log every request" hook can't produce meaningful before/after diffs or domain-specific action names. See `AuditLog` in `docs/database.md`.

## Soft delete

Car, Client, Rental, Payment, Expense, MaintenanceRecord are never hard-deleted. Repositories filter `deletedAt IS NULL` by default (`notDeleted()` helper); an explicit `includeArchived` flag opts into seeing archived rows (reports, audit views). `DELETE` API endpoints archive; `POST .../restore` un-archives.

## Roles

`User.role` (`ADMIN` only today) plus an `authorize(...roles)` middleware seam, so multi-user/role support later doesn't require touching every route — see `docs/roadmap.md`.

## PDF contracts

`backend/src/lib/pdf-generator/` (built in Phase 4c): an HTML template (French + Arabic, RTL block) rendered to PDF by Puppeteer (headless Chromium), uploaded to Cloudinary, linked from `ContractDocument`. Chosen over `@react-pdf/renderer` for print fidelity and easier layout customization — see `docs/business-rules.md` for confirmed contract languages.

## Reminders (data-model ready, not built)

No scheduler/notification channel in v1. `RemindersService.getUpcoming()` (`backend/src/services/reminders.service.ts`) already queries the relevant date fields (rental return dates, maintenance due dates, license/insurance/inspection/registration expiries) so a future cron only has to call an existing method, not change the schema.

## Dashboard performance

KPI queries use Prisma `aggregate`/`groupBy`, never `findMany` + in-memory reduce. `Rental.dailyRate`/`totalAmount` are snapshotted at creation so revenue queries sum a stored column. Indexes exist on every field a dashboard filter/groups by (`Rental.status`, `(carId, pickupDate, plannedReturnDate)`, `Expense.date`, etc.) — see `docs/database.md`.

## Monorepo layout

npm workspaces: `backend/`, `frontend/`, `packages/shared/` (enums + Zod schemas + API envelope type, consumed by both apps without a build step — see `docs/api.md`). One repo because this is a single deployable internal tool, not because of tooling preference — see `docs/deployment.md` for how the three pieces ship together via Docker.

## Frontend

Feature-based folders (`frontend/src/features/{cars,clients,rentals,finances,maintenance,reports,settings,auth,dashboard}`), not type-based — each module owns its API calls, hooks, and pages. Shared UI primitives (shadcn/ui) live in `frontend/src/components`.
