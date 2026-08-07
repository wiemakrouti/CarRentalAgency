# Features

User-facing description of each module. UI text is French; this doc uses the English module names for cross-referencing code (see `docs/business-rules.md` for the naming convention).

Status: **Phase 4b shipped** (design system, app shell, authentication, Cars, Clients, Rentals — creation + lifecycle). This file is filled in module-by-module as each ships (see `docs/roadmap.md`).

Every module from Cars onward fetches and mutates server data through TanStack Query, not ad-hoc `useEffect`/`useState` — one `QueryClient`, one query-key-factory convention per module, one shared loading/empty/error pattern (see `docs/architecture.md` "Server state (TanStack Query)"). This is a standing architectural decision, not something each module re-evaluates.

- **Authentication** — single administrator login.
- **Dashboard** — KPI overview (active rentals, revenue, overdue returns, fleet utilization).
- **Cars** — fleet inventory, photos, status, availability.
- **Clients** — renter records, ID/license documents, blacklist flag.
- **Rentals** — full lifecycle: create (availability check, auto price calc, deposit), activate (pickup), return (late fee auto-computed, damage charges), extend, cancel, history, bilingual (FR/AR) PDF contract.
- **Finances** — payments ledger, expenses, revenue/expense summary.
- **Maintenance** — service records per car, cost tracking, due-date/mileage tracking.
- **Reports & Statistics** — charts and exportable reports.
- **Settings** — agency profile, currency, contract languages, deposit default.
