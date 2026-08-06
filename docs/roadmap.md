# Roadmap

Each phase is a reviewable, testable increment (`CLAUDE.md`: "no feature without proper planning"). Checked phases are done; update this file as each phase ships.

- [x] **Phase 0** — Project setup: npm workspaces, TS/ESLint/Prettier, full Prisma schema (all entities, soft delete, AuditLog, Role), first migration, `docker-compose.yml` + Dockerfiles, base Express app + base Vite/React/Tailwind/shadcn app, seed script skeleton, `/docs` folder.
- [x] **Phase 1a** — Design system & app shell (UI only, no auth/business logic): full token-based design system (colors, typography, radius, shadows) on shadcn/ui, light/dark/system theme with persistence, collapsible sidebar + topbar + mobile drawer, Ctrl/Cmd+K command palette (static data), breadcrumb-aware routing for all 8 nav pages as empty placeholders, visual-only Dashboard (seeded KPI cards + static-data charts), dev-only `/design-system` component showcase. See `docs/design-system.md`.
- [x] **Phase 1b** — Authentication: JWT access tokens + stateful, rotating, hashed refresh tokens (`RefreshToken` table, reuse-detection revokes all sessions on theft signal), `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `authorize('ADMIN')` wired, login/logout audited, frontend `ProtectedRoute` + silent-refresh-on-boot + real login page. See `docs/api.md` and `docs/database.md` "Authentication".
- [x] **Phase 2** — Cars module: CRUD (soft-delete + restore), Cloudinary image upload (add/delete/set-primary), audit logging (`CREATE`/`UPDATE`/`DELETE`/`RESTORE`/`CAR_IMAGE_*`), server-side list/filter/search/pagination via TanStack Query. See `docs/api.md` and `docs/architecture.md` "Server state (TanStack Query)".
- [ ] **Phase 3** — Clients module: CRUD (soft-delete + restore), documents, blacklist flag, audit logging.
- [ ] **Phase 4a** — Rentals — creation: availability check, price calc, deposit, create; audited.
- [ ] **Phase 4b** — Rentals — lifecycle: activate/return (auto late fee)/extend/cancel; rental history + audit trail views.
- [ ] **Phase 4c** — Contract PDF: HTML template + Puppeteer, French/Arabic (RTL), Cloudinary upload.
- [ ] **Phase 5** — Finances: payments ledger, expenses CRUD, damage-fee attachments, aggregate-based summary.
- [ ] **Phase 6** — Maintenance: CRUD, cost tracking, due-date/mileage fields.
- [ ] **Phase 7** — Reports & Dashboard KPIs: aggregate queries, Recharts UI, overdue-rentals widget.
- [ ] **Phase 8** — Settings module: agency profile, currency, contract languages, deposit default; changes audited.
- [ ] **Phase 9** — Seed script completion (realistic fake data via `@faker-js/faker`: 30-50 cars, 100 clients, 200 rentals, payments, expenses, maintenance, audit logs); testing pass (unit, integration, one E2E rental lifecycle).
- [ ] **Phase 10** — Hardening & docs: security review (rate limiting on `/auth/login`, CORS lock-down), performance pass, final docs consistency pass.
