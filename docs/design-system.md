# Design System

UI foundation built in Phase 1a (`docs/roadmap.md`) — before any business feature — so every later module reuses the same tokens, primitives, and shell instead of re-deriving styling per page. Frontend only; no backend/auth changes.

## Stack

shadcn/ui (`new-york` style) on Radix UI primitives + Tailwind CSS, `recharts` for charts, `sonner` for toasts, `cmdk` (via shadcn's `command`) for the command palette, self-hosted `Inter` via `@fontsource`.

## Design tokens

Defined as HSL CSS custom properties in `frontend/src/index.css` (`:root` for light, `.dark` for dark), mapped to Tailwind utilities in `frontend/src/tailwind.config.ts`.

- **Primary** — Blue (`hsl(221 83% 53%)` light / `217 91% 60%` dark). Buttons, links, active nav state, focus rings.
- **Accent** — Emerald tint. Hover/selected backgrounds (dropdown items, ghost button hover, sidebar hover) — a soft emerald tint rather than a bold color, keeping the UI minimal.
- **Neutral** — Zinc scale. `background`, `foreground`, `card`, `popover`, `secondary`, `muted`, `border`, `input`.
- **Status colors** — `success` (emerald), `warning` (amber), `destructive`/danger (red). `success`/`warning` are additions beyond shadcn's default set (which only ships `destructive`); wired into `Badge` and `Alert` variants.
- **Chart palette** — `chart-1` … `chart-5`, five distinct hues for `recharts` series, also theme-aware.
- **Sidebar** — separate `sidebar`/`sidebar-foreground`/`sidebar-accent`/`sidebar-border`/`sidebar-ring` tokens so the sidebar can sit at a slightly different elevation than the main content without hardcoding a color.

Other scales in the same two files: `radius` (sm/md/lg/xl), elevation shadows (`shadow-xs`/`shadow-elevation`/`shadow-popover`), and `fontFamily.sans` = Inter.

**Font**: `@fontsource/inter`, imported in `index.css` as `latin`/`latin-ext` subsets only (400/500/600/700) — covers French accented characters without shipping unused Cyrillic/Greek/Vietnamese glyph subsets.

## Theme system

`frontend/src/providers/theme-provider.tsx` — `ThemeProvider` + `useTheme()`. Three modes: `light` / `dark` / `system`, persisted to `localStorage` (`car-rental-theme`), live-updates on OS preference change when in `system` mode. A blocking inline script in `index.html` applies the `dark` class before first paint to prevent a flash of the wrong theme. The `ThemeToggle` (`components/layout/theme-toggle.tsx`) in the topbar exposes all three modes via a dropdown.

## Component inventory

### `components/ui/` — shadcn/Radix primitives (generated, installed via `npx shadcn add`)

accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, card, checkbox, collapsible, command, context-menu, dialog, dropdown-menu, form, input, label, popover, radio-group, scroll-area, select, separator, sheet, skeleton, sonner (toast), switch, table, tabs, tooltip.

`badge` and `alert` have `success`/`warning` variants added on top of the shadcn defaults.

### `components/common/` — composite building blocks used across feature pages

| Component | Purpose |
|---|---|
| `EmptyState` | No-data placeholder (icon + title + description + optional action) |
| `LoadingState` | Centered spinner + message |
| `ErrorState` | Destructive-tinted error block with optional retry |
| `ConfirmDialog` | Controlled confirm-before-destructive-action dialog, handles async `onConfirm` with a pending/spinner state |
| `PageHeader` | Title + description + right-aligned actions row |
| `PageContainer` | Consistent page padding/gap wrapper |
| `KpiCard` | Label + big value + icon + up/down/neutral trend |
| `ChartCard` | `Card` wrapper with header + sized content slot for a chart |
| `SearchBar` | Controlled search input with icon + clear button (no search logic wired) |
| `FilterBar` | Horizontal row for filter controls + "clear filters" action |
| `Pagination` | Prev/next + numbered pages with ellipsis collapsing for large page counts |

### `components/layout/` — application shell

| Component | Purpose |
|---|---|
| `AppShell` | Root layout: sidebar + topbar + `<Outlet/>`, owns command-palette open state |
| `Sidebar` | Desktop collapsible nav rail (`w-64` ↔ `w-16`, collapse state persisted via `hooks/use-sidebar-collapsed.ts`) |
| `SidebarNav` | Shared nav list (desktop sidebar + mobile drawer), active-route highlighting |
| `MobileNav` | Hamburger-triggered `Sheet` drawer, reuses `SidebarNav` |
| `Topbar` | Mobile nav trigger, route breadcrumb, search trigger, notifications, theme toggle, user menu |
| `ThemeToggle` | Light/Dark/System dropdown |
| `CommandPalette` | Ctrl/Cmd+K global palette |

## Navigation & routing

`frontend/src/lib/navigation.ts` is the single source of truth for the 8 nav items (label, path, icon) — consumed by `SidebarNav` and `CommandPalette`. Paths are English (`/cars`, `/clients`, …) per the "English in code, French in UI" convention in `docs/architecture.md`; labels are French.

`frontend/src/app/routes.tsx` wires all 8 pages as children of the `AppShell` layout route. Each route sets `handle: { breadcrumb: '...' }`; `Topbar` builds the breadcrumb trail from `useMatches()`. The Dashboard route is lazy-loaded (`lazy: () => import(...)`) so `recharts` doesn't bloat the shared bundle for pages that don't chart anything — confirmed via production build: `recharts` lives in its own ~400KB chunk loaded only on `/`.

Every page today is a `PageContainer` + `PageHeader` + `EmptyState` ("Module en cours de construction") except Dashboard, which has seeded `KpiCard`s and two static-data `ChartCard`s (area + bar). **No business logic, API calls, or auth guard exist yet** — see Phase 1b in `docs/roadmap.md`.

## Command Palette

`components/layout/command-palette.tsx`. Global `Ctrl/Cmd+K` listener toggles it open. The "Navigation" group performs real routing; "Clients récents", "Voitures récentes", and "Actions rapides" groups render static placeholder data and are non-functional — the component is complete, actual search/data wiring is deferred to the phase that builds each respective module.

## Dev-only component showcase

`frontend/src/dev/design-system/DesignSystemPage.tsx`, served at `/design-system`. Registered only when `import.meta.env.DEV` is true, so it's excluded from the production bundle entirely (verified: a prod build produces no chunk referencing it), not just hidden from navigation. Catalogs every token and component in both themes — the reference to check against when a new page is built later.

## Known deferrals

- Authentication shipped in Phase 1b (`docs/api.md`, `docs/database.md`) — every route now requires a session; see `frontend/src/providers/auth-provider.tsx` and `frontend/src/components/layout/protected-route.tsx`.
- `SearchBar`/`FilterBar`/`Pagination`/`CommandPalette` render but don't query real data — wired up when each feature module (Cars, Clients, Rentals, …) is built.
- Dashboard charts use static local arrays, not API data — real aggregation queries come in the Reports phase (`docs/roadmap.md`).
