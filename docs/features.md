# Features

User-facing description of each module. UI text is French; this doc uses the English module names for cross-referencing code (see `docs/business-rules.md` for the naming convention).

Status: **Phase 0** — schema and scaffolding only, no feature UI/API yet. This file is filled in module-by-module as each ships (see `docs/roadmap.md`).

- **Authentication** — single administrator login.
- **Dashboard** — KPI overview (active rentals, revenue, overdue returns, fleet utilization).
- **Cars** — fleet inventory, photos, status, availability.
- **Clients** — renter records, ID/license documents, blacklist flag.
- **Rentals** — full lifecycle: create (availability check, auto price calc, deposit), activate (pickup), return (late fee auto-computed, damage charges), extend, cancel, history, bilingual (FR/AR) PDF contract.
- **Finances** — payments ledger, expenses, revenue/expense summary.
- **Maintenance** — service records per car, cost tracking, due-date/mileage tracking.
- **Reports & Statistics** — charts and exportable reports.
- **Settings** — agency profile, currency, contract languages, deposit default.
