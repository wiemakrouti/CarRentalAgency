# Architecture

Internal dashboard for a single French-speaking car rental agency (not SaaS): one director (`ADMIN`) and their employees (`EMPLOYEE`). Naming convention: **English in all code** (folders, files, DB, API, variables), **French in the UI only**.

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

## Guarded state transitions (concurrency)

Any status transition that must not race (Rental activate/return/extend/cancel, and Car's status flips within them) goes through an atomic DB-level guard rather than a read-then-write: `repository.updateGuarded(id, expectedStatuses, data, tx)` issues `db.<model>.updateMany({ where: { id, status: { in: expectedStatuses } }, data })` and the caller checks `count === 1` — Postgres's row lock during the `UPDATE` makes this safe under concurrent requests without hand-rolled locking, and a `count` of `0` means someone else already moved it, surfaced as a clear `409` domain error rather than a silent double-transition. `RentalsService.activate`/`returnRental`/`extend` additionally run their transaction under Postgres `Serializable` isolation, because `extend` performs a read (the overlap check) then a write and needs protection against write-skew, not just a single-row race. Any future module with its own state machine (e.g. Maintenance `scheduled → in_progress → done`) should reuse this pattern rather than inventing a new one.

## Soft delete

Rental, Payment, Expense, MaintenanceRecord are never hard-deleted. Repositories filter `deletedAt IS NULL` by default (`notDeleted()` helper); an explicit `includeArchived` flag opts into seeing archived rows (reports, audit views). `DELETE` API endpoints archive; `POST .../restore` un-archives.

Car and Client are the exceptions: neither has a `deletedAt` column or archive/restore — `DELETE /cars/:id` (`CarsService.delete`) / `DELETE /clients/:id` (`ClientsService.delete`) hard-delete for real. Both deletes are guarded, not soft: `CarsRepository.countRelations` blocks a car's deletion (`409 CAR_HAS_HISTORY`) if it has any Rental, Expense, or MaintenanceRecord row, and `ClientsRepository.countRelations` blocks a client's (`409 CLIENT_HAS_HISTORY`) if it has any Rental row — neither relation cascades on purpose, since losing that history isn't recoverable the way un-archiving is. `CarStatus` (e.g. `OUT_OF_SERVICE`) is how an admin takes a car out of rotation without erasing it; a client with a problem instead gets flagged via `notes` — there's no equivalent status field to retire a client without deleting them.

## Roles

`User.role` is `ADMIN` (the agency's director) or `EMPLOYEE`. Employees run the day-to-day work; the director supervises. Each person has their own account — never a shared one, so every audit entry is attributed to whoever actually acted.

- **Team management** (`TeamService`, `/users`, admin only): the director creates an employee with a temporary password they hand over. Such an account has `mustChangePassword = true`: `authenticate` refuses every request except `GET /auth/me`, `PATCH /auth/me/password` and `POST /auth/logout` (`authenticateAccount`) until the employee picks their own password, and the frontend shows only a "Choisissez votre mot de passe" screen. The director can edit an employee, reset their password (same temporary-password flow, sessions revoked) or deactivate them (`deactivatedAt`).
- **Immediate effect**: `authenticate` re-reads the account (`UsersRepository.findAccountStatus`) on every request instead of trusting the JWT alone, so a deactivation — or a role change — applies on the very next request, not when the 15-minute access token expires. A deactivated account can't log in or refresh either. Login only reports a deactivation once the password is known to be right, so a wrong password never reveals whether an account exists.
- **Permissions** are decided once, in `packages/shared/src/permissions.ts` (`PERMISSIONS` + `can(role, permission)`). The backend enforces them with `authorizePermission(permission)` on the routes; the frontend reads the same list (`useCan`, `RequirePermission`, `navItemsFor`) to hide what a role can't use — only a convenience, the API refuses regardless. Anything not listed is open to every member of the agency. The employee runs the whole day-to-day work (rentals — cancelling and negotiated prices included — clients, cars, payments, deposits, expenses, finances including profit); the director alone may `team.manage`, `audit.view`, `settings.update` (agency settings and logo, and the profile page's "Profil de l'agence" tab), `car.delete`, `client.delete`, `payment.archive` and `expense.archive` (archive/restore) — the actions that manage the team, change the agency itself, or would erase a trace of what happened.
- **Activity journal** (`ActivityService`, `GET /activity`): the audit log, read back. The director (`audit.view`) sees the whole agency and can filter by member; an employee gets "Mon activité" — their own actions only, enforced by the API whatever `userId` is asked for (the same page, with no member filter and no team/settings categories). Every audit row carries its `agencyId` (`AuditService.record` takes it from the author's account, or explicitly for automatic actions like `RENTAL_AUTO_CANCEL`). The frontend turns each entry into a French sentence (`features/activity/lib/describe-activity.ts`), with the before → after details of an edit. Sign-ins and account changes form their own category, hidden unless asked for.
- A "Location immédiate" (rental created with `initialPayment` and/or `activation`) records one audit entry per real-world event, in the same transaction: `CREATE Rental`, then `CREATE Payment`, then `RENTAL_ACTIVATE` — so the journal and the team summary count it exactly like a booking followed by a separate payment and handover.
- **Approvals** (`ApprovalRequest`, `ApprovalsService`, `/approvals`): three actions an employee can't do alone — changing a car's catalogue rate, recording an expense at or above `Setting.largeExpenseThreshold` (500 DT by default, raising an existing one past it included), booking more than `Setting.largeDiscountThreshold` percent (15 by default) below the catalogue rate. They go through the usual endpoints and forms (same buttons): for an employee crossing the line, `POST /rentals` and `POST|PATCH /finances/expenses` answer **202** with `{ approvalRequest }` instead of the record, and `PATCH /cars/:id` saves every other field but leaves the rate, returning the car with its `approvalRequest`. The action doesn't exist until the director validates: `ApprovalsService.approve` claims the request (guarded PENDING → APPROVED, so a double click can't run it twice), re-parses the stored payload with the same zod schema and runs the normal service **as the employee** (the journal shows it under their name); if that fails (the car got booked meanwhile, an immediate rental validated another day…) nothing is created and the request goes back to pending with the reason. Refusing or the employee withdrawing just closes it. The director's own actions never need approval; everything else an employee does goes straight through and only shows in the activity journal. Frontend: the "Journal d'activité" link counts the pending requests (refreshed every 30 s), the journal has Valider/Refuser on each waiting request, and the employee's notification bell has a "Mes demandes" view with the answers (`requesterSeenAt` marks them read).
- The director's own account is never manageable through `/users` (`CANNOT_MANAGE_ADMIN`): it's edited from the profile page, so the director can't lock themselves out.

## PDF contracts

`backend/src/lib/pdf-generator/` (built in Phase 4c): an HTML template (French + Arabic, RTL block) rendered to PDF by Puppeteer (headless Chromium), uploaded to Cloudinary, linked from `ContractDocument`. Chosen over `@react-pdf/renderer` for print fidelity and easier layout customization — see `docs/business-rules.md` for confirmed contract languages.

## Reminders (data-model ready, not built)

No scheduler/notification channel in v1. `RemindersService.getUpcoming()` (`backend/src/services/reminders.service.ts`) already queries the relevant date fields (rental return dates, maintenance due dates, license/insurance/inspection/registration expiries) so a future cron only has to call an existing method, not change the schema.

## Dashboard performance

KPI queries use Prisma `aggregate`/`groupBy`, never `findMany` + in-memory reduce. `Rental.dailyRate`/`totalAmount` are snapshotted at creation so revenue queries sum a stored column. Indexes exist on every field a dashboard filter/groups by (`Rental.status`, `(carId, pickupDate, plannedReturnDate)`, `Expense.date`, etc.) — see `docs/database.md`.

## Monorepo layout

npm workspaces: `backend/`, `frontend/`, `packages/shared/` (enums + Zod schemas + API envelope type, consumed by both apps without a build step — see `docs/api.md`). One repo because this is a single deployable internal tool, not because of tooling preference — see `docs/deployment.md` for how the three pieces ship together via Docker.

## Frontend

Feature-based folders (`frontend/src/features/{cars,clients,rentals,finances,maintenance,reports,settings,auth,dashboard}`), not type-based — each module owns its API calls, hooks, and pages. Shared UI lives in `frontend/src/components`: `ui/` (shadcn/Radix primitives), `common/` (composite building blocks — empty/loading/error states, page header/container, KPI/chart cards, search/filter/pagination), `layout/` (app shell — sidebar, topbar, mobile nav, command palette). Theme state lives in `frontend/src/providers`; the nav config (`frontend/src/lib/navigation.ts`) drives both the sidebar and the command palette. Full token/component reference: `docs/design-system.md`.

### Server state (TanStack Query)

Standing decision, applies to every feature module (Cars, Clients, Rentals, Finances, Maintenance, Reports, Settings) — not something each module re-decides. `QueryClient` is configured once in `frontend/src/lib/query-client.ts` (`staleTime: 30s`, `retry: 1`) and provided at the root in `main.tsx`, above the router. Dev-only Devtools (`frontend/src/dev/query-devtools.tsx`) follow the same DEV-gated dynamic-import pattern as the `/design-system` route — excluded from the production bundle, not just hidden.

Per feature module, three kinds of file, none optional:

- **`features/{module}/api/{module}.api.ts`** — the *only* place that calls `apiClient` for that module. Plain async functions (`list`, `getById`, `create`, `update`, `archive`, `restore`, ...), no React.
- **`features/{module}/api/{module}.keys.ts`** — a query key factory (e.g. `carKeys`), the pattern every module copies:
  ```ts
  export const carKeys = {
    all: ['cars'] as const,
    lists: () => [...carKeys.all, 'list'] as const,
    list: (filters: CarListParams) => [...carKeys.lists(), filters] as const,
    detail: (id: string) => [...carKeys.all, 'detail', id] as const,
  };
  ```
- **`features/{module}/hooks/use-{module}.ts`** — `useQuery`/`useMutation` wrappers pages actually import. Mutations invalidate the affected `{module}Keys` on success (e.g. creating a car invalidates `carKeys.lists()`; updating one invalidates both its `detail(id)` and `lists()`). Optimistic updates only where a mutation's outcome is predictable enough to be worth it (e.g. archive/restore toggling a list row) — not a default for every mutation.

Pages call only the hooks layer, never `apiClient` or `useQuery`/`useMutation` directly. Loading/empty/error rendering is not ad-hoc per page — hooks' `isLoading`/`isError`/empty-array states map onto the Phase 1 `LoadingState`/`EmptyState`/`ErrorState` composites (`docs/design-system.md`), the same three states every page already uses.

TanStack Query's job stops at fetching, caching, synchronization, and request lifecycle (retries, refetch-on-focus, optimistic updates) — it never contains business logic; that stays server-side per the layering above. No feature page hand-rolls `useEffect` + `useState` for server data.

A 401 that survives `apiClient`'s silent-refresh retry (`frontend/src/lib/auth-session.ts`) calls `notifySessionExpired()`, which `AuthProvider` listens for to flip to `unauthenticated` and let `ProtectedRoute` redirect — this covers session death from a background query refetch, not just the initial page load.
