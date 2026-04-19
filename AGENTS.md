# Autopilot — Agent Onboarding Guide

> This document is written for AI coding agents. It assumes zero prior knowledge of the project. Read this before making any code changes.

---

## 1. Project Overview

This repository contains **Autopilot**, a facility-management SaaS platform. The product helps property managers, admins, staff, tenants, and vendors track tickets, visitors, inventory, meeting rooms, and standard operating procedures (SOPs).

The repo is organized as a **poly-repo-at-root** — there is no single root `package.json`. The two primary applications live in separate sub-directories:

| Directory | What it is | Tech stack |
|-----------|------------|------------|
| `saas_development/` | Web dashboard & marketing site | Next.js 16.1.1, React 19.2.3, TypeScript 5, Tailwind CSS v4, Supabase |
| `saas_mobile/` | React Native mobile app | Expo SDK ~54.0.0, React Native 0.81.5, React 19.1.0, TypeScript ~5.9.2, Expo Router ~6.0.0 |
| `config/` | Shared deployment env template | `.env.example` |
| `ios-config/` / `android-config/` / `fastlane-config/` | Store-submission assets | Plist additions, Gradle snippets, Fastlane files |

Other directories at root (`superpowers/`, `claude-mem/`, `awesome-claude-code-subagents/`, `kimi super admin dashboard /`, `autopilot-preview/`, `autopilot-web-preview/`) are **third-party tools, plugins, or prototypes**. Do not edit them unless explicitly asked.

---

## 2. Technology Stack

### 2.1 Web App (`saas_development/`)

- **Framework**: Next.js 16.1.1 (App Router)
- **UI**: React 19.2.3, Tailwind CSS v4, `lucide-react`, `framer-motion`, `recharts`, `chart.js`
- **State / Data**: Supabase (`@supabase/supabase-js`, `@supabase/ssr`, `@supabase/auth-helpers-nextjs`), Auth0 (`@auth0/auth0-react`)
- **Forms**: `react-hook-form` + `zod`
- **PWA / Offline**: `@serwist/next` (service-worker generation; requires webpack build)
- **Charts / Visualization**: `recharts`, `chart.js`, `react-liquid-gauge`
- **AI / LLM**: `@anthropic-ai/sdk`, `groq-sdk`, `@modelcontextprotocol/sdk`
- **Media / Files**: `html2canvas`, `jspdf`, `pdfjs-dist`, `browser-image-compression`
- **Data Processing**: `papaparse`, `xlsx`, `exceljs`
- **Firebase**: `firebase`, `firebase-admin`
- **Email / Notifications**: `nodemailer`, `web-push`
- **Build target**: Vercel (see `vercel.json`)

### 2.2 Mobile App (`saas_mobile/`)

- **Framework**: Expo SDK ~54.0.0, React Native 0.81.5, React 19.1.0
- **Router**: Expo Router ~6.0.0 (file-based)
- **State**: Zustand ^5.0.3, React Context, `react-native-mmkv` + `@react-native-async-storage/async-storage` for persistence
- **Backend**: Supabase (`@supabase/supabase-js`)
- **Forms**: `react-hook-form` ^7.54.0 + `zod` ^3.24.0
- **UI / Animation**: `react-native-reanimated` ~4.1.0, `react-native-gesture-handler` ~2.28.0, `@gorhom/bottom-sheet` ^5.1.0, `lucide-react-native` ^1.7.0, `victory-native` ^41.16.0
- **Media**: `expo-camera`, `expo-image-picker`, `expo-av`, `expo-media-library`
- **Push**: `expo-notifications`, `@notifee/react-native`
- **Auth**: `@invertase/react-native-apple-authentication`, `@react-native-google-signin/google-signin`
- **AI / Voice**: `openai` ^6.33.0, `expo-speech`, extensive Cassandra voice pipeline
- **Build target**: EAS (Expo Application Services) — see `eas.json`

---

## 3. Code Organization

### 3.1 Web App (`saas_development/`)

```
saas_development/
├── app/                         # Next.js App Router
│   ├── (auth)/                  # Unauthenticated pages (login, signup, forgot-password, reset-password)
│   ├── (dashboard)/             # Dashboard layout wrapper
│   │   └── [orgId]/             # Org-scoped authenticated pages
│   │       ├── dashboard/
│   │       ├── flow-map/
│   │       ├── properties/[propertyId]/
│   │       ├── rooms/
│   │       ├── settings/
│   │       └── users/
│   ├── onboarding/              # Onboarding flow
│   ├── privacy/ / terms/        # Static legal pages
│   ├── master/                  # Master admin pages
│   ├── procurement/             # Procurement pages
│   ├── join/[propertyCode]/     # Property join flow
│   ├── kiosk/[propertyId]/      # Kiosk mode
│   ├── tickets/[ticketId]/      # Public ticket view
│   ├── loader-test/ / simple-test/ / test-loader/  # Debug pages
│   ├── api/                     # API routes (150+ files)
│   │   ├── cron/                # 11 Vercel cron jobs
│   │   ├── tickets/             # Ticket CRUD, batch ops, comments, media
│   │   ├── properties/          # Property management
│   │   ├── users/               # User CRUD, invites
│   │   ├── vms/                 # Visitor management
│   │   ├── vendors/             # Vendor management
│   │   ├── stock/               # Inventory
│   │   ├── sop/                 # SOP management
│   │   ├── ppm/                 # Planned Preventive Maintenance
│   │   ├── escalation/          # Escalation hierarchies
│   │   ├── meeting-rooms/       # Meeting room bookings
│   │   ├── reports/             # Reports & analytics
│   │   ├── auth/                # Auth callbacks, Zoho OAuth
│   │   ├── webhooks/            # WhatsApp webhooks
│   │   └── ...
│   ├── layout.tsx               # Root layout (fonts, providers, SW registration)
│   ├── template.tsx             # Root template
│   ├── globals.css              # Tailwind v4 + Apple-inspired design tokens
│   └── page.tsx                 # Landing / home
├── frontend/
│   ├── components/              # React components (by feature)
│   │   ├── ui/                  # Shared primitives (button, card, input, label, glass-card, Loader, Toast, etc.)
│   │   ├── tickets/             # Ticket-specific components
│   │   ├── dashboard/           # Dashboard widgets
│   │   ├── auth/                # Auth flows
│   │   ├── admin/               # Admin UI
│   │   ├── analytics/           # Analytics & reporting
│   │   ├── diesel/              # Diesel management
│   │   ├── electricity/         # Electricity / utilities
│   │   ├── escalation/          # Escalation UI
│   │   ├── landing/             # Marketing / landing page
│   │   ├── layout/              # Layout shells
│   │   ├── meeting-rooms/       # Meeting room booking
│   │   ├── mst/                 # MST components
│   │   ├── ops/                 # Operations
│   │   ├── ppm/                 # PPM components
│   │   ├── shared/              # Shared non-UI components
│   │   ├── snags/               # Snag/defect management
│   │   ├── sop/                 # SOP management
│   │   ├── stock/               # Inventory / stock
│   │   ├── users/               # User management
│   │   ├── utilities/           # Utilities components
│   │   ├── vendor/ / vendors/   # Vendor-related
│   │   └── vms/                 # Visitor management
│   ├── context/                 # React contexts (Auth, Theme, Global, DataCache)
│   ├── hooks/                   # Custom hooks
│   ├── utils/                   # Utilities
│   └── types/                   # Frontend TypeScript types
├── backend/
│   ├── services/                # Server-side services
│   │   ├── authService.ts
│   │   ├── dashboardService.ts
│   │   ├── EmailService.ts
│   │   ├── NotificationService.ts   # Largest service (~50 KB)
│   │   ├── userService.ts
│   │   ├── WhatsAppService.ts
│   │   └── WhatsAppQueueService.ts
│   ├── lib/                     # Backend helpers (Supabase admin, Firebase, LLM/Groq, ticketing, WhatsApp, audit logging)
│   ├── db/
│   │   ├── migrations/          # 105+ Supabase SQL migrations
│   │   └── schema/              # Schema dumps and debug SQL
│   └── scripts/                 # One-off backend scripts
├── lib/                         # Shared cross-boundary helpers
│   ├── database.types.ts        # Placeholder: export type Database = any
│   └── mcp-client.ts
├── docs/                        # Implementation plans, walkthroughs, performance docs
├── next.config.ts               # Next.js config (webpack mode for serwist)
├── postcss.config.mjs           # Tailwind CSS v4 PostCSS plugin
├── eslint.config.mjs            # ESLint v9 flat config (next/core-web-vitals + next/typescript)
├── tsconfig.json                # Strict TypeScript, path aliases
└── package.json
```

**Path aliases (web)** — defined in `tsconfig.json`:
- `@/*` → `./*`
- `@frontend/*` → `./frontend/*`
- `@backend/*` → `./backend/*`
- `@components/*` → `./frontend/components/*`
- `@hooks/*` → `./frontend/hooks/*`
- `@context/*` → `./frontend/context/*`
- `@utils/*` → `./frontend/utils/*`
- `@types/*` → `./frontend/types/*`
- `@constants/*` → `./frontend/constants/*`
- `@services/*` → `./backend/services/*`
- `@lib/*` → `./backend/lib/*`

### 3.2 Mobile App (`saas_mobile/`)

```
saas_mobile/
├── app/                         # Expo Router file-based routes
│   ├── (auth)/                  # Unauthenticated routes
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   ├── forgot-password.tsx
│   │   ├── reset-password/
│   │   ├── onboarding.tsx
│   │   ├── property-selection.tsx
│   │   ├── voice-enrollment.tsx
│   │   └── _layout.tsx
│   ├── org/[orgId]/             # Org-scoped routes
│   │   ├── index.tsx
│   │   └── property/[propertyId]/
│   │       ├── index.tsx
│   │       └── _layout.tsx
│   ├── property/[propertyId]/   # Property-scoped routes (primary navigation)
│   │   ├── index.tsx
│   │   ├── dashboard/
│   │   ├── tickets/[id].tsx
│   │   ├── tickets/index.tsx
│   │   ├── visitors/
│   │   ├── stock/ / stock/scan/
│   │   ├── checklist/
│   │   ├── rooms/
│   │   ├── settings/
│   │   ├── profile.tsx
│   │   ├── users/
│   │   ├── staff/
│   │   ├── vendor/
│   │   ├── diesel/ / diesel/analytics.tsx
│   │   ├── electricity/ / electricity/analytics.tsx
│   │   ├── escalation/
│   │   ├── flow-map/
│   │   ├── mst/ / mst/requests/[requestId]/
│   │   ├── ppm/
│   │   ├── reports/ / reports/requests/ / reports/executive-summary/
│   │   ├── reports/snags/ / reports/snags/[importId]/
│   │   ├── reports/[importId]/
│   │   ├── security/
│   │   ├── soft-service-manager/
│   │   ├── tenant/
│   │   └── _layout.tsx
│   ├── cassandra/               # Cassandra voice/AI routes
│   │   ├── index.tsx
│   │   └── rooms/ / rooms/[roomId].tsx
│   ├── api/                     # API routes
│   ├── index.tsx                # Entry redirect / root
│   ├── +not-found.tsx           # 404 screen
│   └── _layout.tsx              # Root layout
├── components/                  # React Native components (NOT under src/)
│   ├── ui/                      # Shared primitives (Button, Input, Card, GlassCard, Label, Loader, Toast, Skeleton, etc.)
│   ├── shared/                  # Shared cross-feature components (TicketCard, PropertyCard, AppBottomNav, CameraCaptureModal, QRScannerModal, CreateTicketModal, ReportCharts, etc.)
│   ├── tickets/                 # Ticket-specific
│   ├── dashboard/               # Dashboard widgets
│   ├── auth/
│   ├── admin/
│   ├── analytics/
│   ├── cassandra/
│   ├── diesel/
│   ├── electricity/
│   ├── escalation/
│   ├── landing/
│   ├── layout/
│   ├── meeting-rooms/
│   ├── mst/
│   ├── ops/
│   ├── ppm/
│   ├── snags/
│   ├── sop/
│   ├── stock/
│   ├── tenant/
│   ├── users/
│   ├── utilities/
│   ├── vendor/ / vendors/
│   ├── vms/
│   └── voice/
├── hooks/                       # Custom hooks
│   ├── useAuth.ts
│   ├── useAppSession.ts
│   ├── usePushNotifications.ts
│   ├── useTicketMedia.ts
│   ├── useWeather.ts
│   ├── cassandra/
│   ├── mst/
│   ├── tenant/
│   └── voice/
├── context/                     # React contexts (Auth, Theme, Global, DataCache, portal)
├── services/                    # API service classes
│   ├── authService.ts
│   ├── ticketService.ts
│   ├── userService.ts
│   ├── propertyService.ts
│   ├── vmsService.ts
│   ├── stockService.ts
│   ├── sopService.ts
│   ├── meetingRoomService.ts
│   ├── reportService.ts
│   ├── voiceEnrollment.ts
│   ├── index.ts                 # Barrel export
│   ├── ai/                      # 12 OpenAI / voice pipeline modules
│   ├── api/
│   │   └── client.ts
│   └── cassandra/
│       ├── cassandraAuthService.ts
│       └── cassandraRoomService.ts
├── store/                       # Zustand stores
│   ├── onboardingStore.ts
│   └── voiceAgentStore.ts
├── lib/                         # Utility functions
│   ├── cassandra.ts
│   ├── firebase.ts
│   ├── ticketMedia.ts
│   ├── toast.ts
│   └── utils.ts
├── types/                       # TypeScript types
│   ├── index.ts
│   ├── core.ts
│   ├── ticketing.ts
│   ├── rbac.ts
│   ├── membership.ts
│   ├── supabase-ext.d.ts
│   ├── cassandra-room.ts
│   └── react-liquid-gauge.d.ts
├── constants/                   # App constants
│   ├── Colors.ts
│   ├── cassandra-theme.ts
│   └── capabilities.ts
├── assets/
│   ├── fonts/                   # Poppins + Urbanist
│   └── images/                  # Icons, splash, adaptive icons, favicon
├── app.json                     # Expo config
├── eas.json                     # EAS build config
├── babel.config.js              # babel-preset-expo + module-resolver aliases
├── metro.config.js              # Metro bundler config (custom @gorhom/portal fix)
├── tsconfig.json                # Strict TypeScript, baseUrl "."
└── package.json
```

**Note**: The mobile project does **not** use a `src/` directory for components — they live at `components/` directly under `saas_mobile/`.

**Path aliases (mobile)** — defined in `babel.config.js` via `module-resolver`:
- `@` → `./`
- `@/app` → `./app`
- `@/assets` → `./assets`
- `@/components` → `./components`
- `@/context` → `./context`
- `@/hooks` → `./hooks`
- `@/lib` → `./lib`
- `@/types` → `./types`
- `@/utils` → `./utils`
- `@/constants` → `./constants`

---

## 4. Build & Development Commands

### 4.1 Web App (`saas_development/`)

```bash
cd saas_development

# Install dependencies
npm install

# Development server (uses webpack because serwist requires it)
npm run dev          # next dev --webpack

# Production build
npm run build        # next build --webpack

# Start production server
npm run start        # next start

# Lint
npm run lint         # eslint
```

### 4.2 Mobile App (`saas_mobile/`)

```bash
cd saas_mobile

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with Supabase credentials:
#   EXPO_PUBLIC_SUPABASE_URL=...
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=...

# Start Expo dev server
npx expo start

# From the Metro prompt:
#   i  → iOS Simulator
#   a  → Android Emulator
#   w  → Web

# Direct platform builds (requires native tooling)
npx expo run:ios
npx expo run:android

# EAS builds
eas build --platform ios
eas build --platform android
eas build --platform all --profile production
```

### 4.3 Useful mobile scripts (from `package.json`)

- `npm start` / `npx expo start`
- `npm run android` — `expo run:android`
- `npm run ios` — `expo run:ios`
- `npm run web` — `expo start --web`
- `npm run tunnel` — `expo start --tunnel`
- `npm test` — `jest`
- `npm run lint` — `eslint .`

---

## 5. Testing

### 5.1 Web App
- There are **no unit-test files** currently present in `saas_development/` (excluding dependency tests inside `node_modules/`).
- Linting is the primary automated gate: `npm run lint`.
- No Playwright, Cypress, Vitest, or Jest config files exist.

### 5.2 Mobile App
- Test runner: **Jest** ^29.7.0 + `jest-expo` ~54.0.0 + `@testing-library/react-native` ^13.2.0.
- Run tests: `cd saas_mobile && npm test`
- No application-level test files (`.test.*`, `.spec.*`, or `__tests__` directories) exist yet — this is a known gap.

### 5.3 General Testing Philosophy
The `superpowers/` plugin (if active in your agent environment) enforces **red-green TDD** via the `test-driven-development` skill. If you are adding features, follow that workflow when it triggers.

---

## 6. Code Style & Conventions

### 6.1 TypeScript
- **Strict mode is enabled** in both projects (`"strict": true`).
- Prefer `interface` over `type` for object shapes unless union types are required.
- Use explicit return types on public service methods.

### 6.2 Imports
- Use the path aliases listed in Section 3. Do not use deep relative paths like `../../../../components` when an alias exists.
- Web aliases are resolved by TypeScript (`tsconfig.json`).
- Mobile aliases are resolved by Babel (`babel-plugin-module-resolver`).

### 6.3 Styling
- **Web**: Tailwind CSS v4 utility classes. Custom theme tokens (colors, fonts) are defined in `globals.css` using CSS variables (Apple-inspired design system: primary `#2997ff`, surfaces `#f5f5f7`).
  - No `tailwind.config.js` exists — Tailwind v4 uses CSS-based configuration.
- **Mobile**: React Native `StyleSheet` objects. Brand colors:
  - Primary: `#708F96` (Slate Blue-Green)
  - Secondary: `#AA895F` (Warm Tan/Gold)
- Typography:
  - Display: **Poppins**
  - Body: **Urbanist**

### 6.4 State Management
- **Web**: React Context for global auth/theme; local `useState` for form state; no Redux.
- **Mobile**: Zustand for auth, notifications, and UI state; React Context for theme/auth wrapper; MMKV + AsyncStorage for persistence.

### 6.5 Backend / Database
- Primary database is **Supabase** (PostgreSQL).
- Migrations live in `saas_development/backend/db/migrations/`. There are **105+ migration files** covering ticketing, stock/inventory, SOPs, user management, RLS policies, escalation hierarchies, PPM, and master admin setup.
- Server-side business logic (notifications, WhatsApp, email) lives in `saas_development/backend/services/`.
- `saas_development/lib/database.types.ts` is currently a placeholder (`export type Database = any`). The project does not use generated Supabase types.

### 6.6 API Routes / Cron Jobs (Web)
The web app defines **11 Vercel cron jobs** in `vercel.json`:

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/check-sop-reminders` | `* * * * *` | SOP reminder checks |
| `/api/cron/check-sop-missed` | `* * * * *` | Missed SOP alerts |
| `/api/cron/check-sla` | `* * * * *` | SLA breach checks |
| `/api/cron/check-escalation` | `* * * * *` | Escalation trigger checks |
| `/api/cron/check-diesel` | `0 * * * *` | Diesel monitoring (hourly) |
| `/api/cron/generate-stock-reports` | `0 0 * * *` | Daily stock reports |
| `/api/cron/daily-whatsapp-report` | `30 18 * * *` | Daily WhatsApp report (18:30) |
| `/api/cron/cleanup-whatsapp-sessions` | `*/30 * * * *` | WhatsApp session cleanup |
| `/api/cron/process-whatsapp-queue` | `* * * * *` | WhatsApp queue processing |
| `/api/cron/ppm-reminders` | `30 3 * * *` | PPM reminders (03:30) |
| `/api/cron/amc-expiry-alerts` | `0 4 * * *` | AMC expiry alerts (04:00) |

If you modify cron logic, update `vercel.json` and ensure the corresponding API route file exists under `app/api/cron/`.

---

## 7. Environment Variables

### 7.1 Web (`saas_development/`)
There is no committed `.env.example` inside `saas_development/`. Required variables (inferred from code) include:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Auth0 config (domain, client ID) if using Auth0 routes
- Firebase config (if using Firebase Admin features)

### 7.2 Mobile (`saas_mobile/`)
Copy `saas_mobile/.env.example` to `saas_mobile/.env` and fill at minimum:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_NAME`
- `EXPO_PUBLIC_APP_VERSION`
- `EXPO_PUBLIC_VOICE_API_URL`
- `EXPO_PUBLIC_CASSANDRA_ECAPA_URL`
- `EXPO_PUBLIC_CASSANDRA_API_URL`
- `EXPO_PUBLIC_CASSANDRA_WS_URL`
- `EXPO_PUBLIC_AUTOPILOT_ORG_ID`
- `EXPO_PUBLIC_ENABLE_ANALYTICS`
- `EXPO_PUBLIC_ENABLE_CRASHLYTICS`

Expo requires the `EXPO_PUBLIC_` prefix for variables to be exposed to the client bundle.

### 7.3 Deployment / Shared
A generic deployment template lives at `config/.env.example`. It covers Firebase, Apple/Google signing, Fastlane, Stripe, Sentry, revenue cat, feature flags, certificate pinning, JWT secrets, and more. This is **mostly for CI/CD and store submission** rather than local development.

---

## 8. Security Considerations

- **Never commit `.env` files** — they are gitignored in both projects.
- The web root layout performs an **aggressive service-worker purge** on first load (see `saas_development/app/layout.tsx`). If you change caching strategy, be aware of the deep-purge logic.
- Supabase RLS policies should be reviewed before exposing new tables. There are extensive RLS-related migrations.
- Certificate pinning and JWT secrets are referenced in `config/.env.example` but are not actively enforced in local dev.
- `next.config.ts` sets `poweredByHeader: false` for security.

---

## 9. Deployment

### 9.1 Web
- Target platform: **Vercel**.
- Build command: `next build --webpack` (required because `serwist` injects a webpack plugin; `turbopack` is explicitly silenced).
- Cron jobs run as Vercel Serverless Functions.
- No GitHub Actions workflows or Docker files exist for the web app.

### 9.2 Mobile
- Build pipeline: **EAS** (`eas build`).
- Profiles: `development` (development client, internal), `preview` (internal, APK for Android), `production`.
- iOS bundle ID: `com.autopilot.app`
- Android package: `com.autopilot.app`
- Store submission assets are prepared in `ios-config/`, `android-config/`, and `fastlane-config/` at the repo root.
- The root `README.md` is actually an App Store deployment guide covering the 8-week quick-start timeline, required accounts, and common pitfalls.

---

## 10. What NOT to Touch

Unless the user explicitly asks you to work on these, leave them alone:

- `superpowers/` — third-party agent-workflow plugin (obra/superpowers)
- `claude-mem/` — third-party Claude Code memory plugin (thedotmack/claude-mem)
- `awesome-claude-code-subagents/` — third-party subagent collection
- `kimi super admin dashboard /` — standalone Expo prototype, not wired to the main app
- `autopilot-preview/` / `autopilot-web-preview/` — tiny preview stubs

---

## 11. Quick Reference Checklist for Agents

Before starting any task:

1. **Which app?** Confirm whether the change belongs to `saas_development/` (web), `saas_mobile/` (mobile), or a shared backend migration.
2. **Env vars?** Check that `.env` exists and required variables are set.
3. **Path aliases?** Use `@components`, `@frontend`, `@services`, `@lib`, etc. on web; use `@/components`, `@/hooks`, etc. on mobile.
4. **Strict TS?** Both projects enforce strict mode — fix type errors before declaring done.
5. **Test?** If you add logic, add a Jest test (mobile) or verify via lint/build (web).
6. **Migration?** If you change the DB schema, place a migration in `saas_development/backend/db/migrations/` with a descriptive name (e.g., `20260311_escalation_hierarchy.sql` or `v2_rls_architecture.sql`).

---

_Last updated: 2026-04-18_
