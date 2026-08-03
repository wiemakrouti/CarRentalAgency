# API

REST, JSON, prefixed `/api/v1`. All routes except `/auth/login` and `/auth/refresh` require `Authorization: Bearer <accessToken>` (see `backend/src/middleware/authenticate.ts`).

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

Planned (see `docs/roadmap.md` for the phase each ships in):

**Auth** — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`

**Cars** — `GET/POST /cars`, `GET/PATCH/DELETE /cars/:id`, `POST /cars/:id/restore`, `POST/DELETE /cars/:id/images(/:imageId)`, `GET /cars/available?pickupDate=&returnDate=`

**Clients** — `GET/POST /clients`, `GET/PATCH/DELETE /clients/:id`, `POST /clients/:id/restore`, `POST/DELETE /clients/:id/documents(/:docId)`

**Rentals** — `GET/POST /rentals`, `GET/PATCH /rentals/:id`, `POST /rentals/:id/activate`, `POST /rentals/:id/return` (auto-computes late fee), `POST /rentals/:id/extend`, `POST /rentals/:id/cancel`, `GET /rentals/:id/contract`, `GET /rentals/history?clientId=|carId=`

**Finances** — `GET/POST /finances/payments`, `POST/DELETE /finances/payments/:id/attachments(/:attachmentId)`, `GET/POST /finances/expenses`, `PATCH/DELETE /finances/expenses/:id`, `GET /finances/summary?from=&to=`

**Maintenance** — `GET/POST /maintenance`, `GET/PATCH/DELETE /maintenance/:id`, `GET /cars/:id/maintenance`

**Reports** — `GET /reports/dashboard`, `GET /reports/revenue?period=`, `GET /reports/fleet-utilization`, `GET /reports/export?type=pdf|csv`

**Settings** — `GET/PATCH /settings`

**Audit** — `GET /audit-logs?entityType=&entityId=&userId=&from=&to=` (admin-only, paginated)
