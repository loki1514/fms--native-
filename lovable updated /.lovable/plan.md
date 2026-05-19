## Goal

The atmospheric weather scene + WeatherToggle and the floating "Ask Cassandra" dock currently live only on `/dashboard/$propertyId`. Lift them into shared primitives and mount them across every profile so the design language is consistent everywhere.

## Where they need to appear

- `/` (role picker, `routes/index.tsx`) — backdrop + dock
- `/super-admin` (portfolio list) — backdrop + WeatherToggle in header + dock
- `/property-admin` — backdrop + WeatherToggle in header + dock (via RoleShell)
- `/mst` — backdrop + WeatherToggle in header + dock (via RoleShell)
- `/dashboard/$propertyId` — refactored to consume the new primitives (no visual change)

## New shared pieces

1. **`src/components/WeatherBackdrop.tsx`**
   - Owns `WeatherMode` state, seeded from local hour via the existing `getInitialMode` logic (move helper into `lib/weather.ts`).
   - Renders `<WeatherScene mode={mode} />` as a fixed full-bleed background.
   - Exposes the current `mode` + `setMode` through a tiny React context (`WeatherContext`) so headers can drop in `<WeatherToggle />` without prop-drilling.
   - Pages wrap their content in `<WeatherBackdrop>…</WeatherBackdrop>`.

2. **`src/components/CassandraDock.tsx`**
   - Lifts the floating bottom nav from `dashboard.$propertyId.tsx` (Home / Building2 / Sidekick orb / BarChart3 / User) into a reusable component.
   - Owns the `chatOpen` state and renders `<SidekickChat />`.
   - Keeps the "Ask Cassandra" floating caption + hover tooltip intact.
   - Accepts an optional `onNavigate` map so each profile can wire its own home/properties/analytics targets (defaults route to `/`, `/super-admin`, etc.).

## Integration per route

- **`routes/index.tsx`** — wrap the role-picker in `WeatherBackdrop`; mount `CassandraDock` at the bottom. No header toggle (no header here).
- **`routes/super-admin.tsx`** — wrap page in `WeatherBackdrop`; add `<WeatherToggle/>` to the right of the "Properties" title (next to the back button); mount `CassandraDock`. Bottom padding bumped to clear the dock.
- **`components/RoleShell.tsx`** — wrap its root in `WeatherBackdrop`; add an optional `<WeatherToggle/>` slot in the header row (left of the bell); always render `CassandraDock`. The existing role tab bar stays; the dock floats above it (z-index higher), or — cleaner — when `tabs` are present we render the dock just above the tab bar with extra bottom offset. Pages using RoleShell (`property-admin`, `mst`) get weather + Cassandra automatically.
- **`routes/dashboard.$propertyId.tsx`** — replace the inline `<WeatherScene>`, `<WeatherToggle>`, floating nav, and `<SidekickChat>` with `WeatherBackdrop` + `CassandraDock`. Header keeps the toggle via the context.

## Technical notes

- Weather mode is per-page (not global) — each `WeatherBackdrop` instance owns its own state so changing weather on one screen doesn't bleed into the next. If a future request asks for cross-page persistence we can promote the context to the root.
- `CassandraDock` needs `pb-28`-style spacing on the page wrapper; RoleShell already has `pb-28`, super-admin will be bumped from `pb-12` to `pb-28`, dashboard already accounts for it.
- Z-index: dock at `z-30` (matches current), modal/sidebar already at `z-40+`.
- No business logic, data, or routing changes — purely presentational lift.

## Out of scope

- No new gamification, no nav target changes, no design token edits.
- No persistence of selected weather mode across reloads.
