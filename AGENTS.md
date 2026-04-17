# Autopilot — Agent Onboarding Guide

> This document is written for AI coding agents. It assumes zero prior knowledge of the project. Read this before making any code changes.

---

## 1. Project Overview

This repository contains **Autopilot**, a facility-management SaaS platform. The product helps property managers, admins, staff, tenants, and vendors track tickets, visitors, inventory, meeting rooms, and standard operating procedures (SOPs).

The repo is organized as a **poly-repo-at-root** — there is no single root `package.json`. The two primary applications live in separate sub-directories:

| Directory | What it is | Tech stack |
|-----------|------------|------------|
| `saas_development/` | Web dashboard & marketing site | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Supabase |
| `saas_mobile/` | React Native mobile app | Expo SDK 54, React Native 0.79, React 19, TypeScript 5.8, Expo Router v5 |
| `config/` | Shared deployment env template | `.env.example` |
| `ios-config/` / `android-config/` / `fastlane-config/` | Store-submission assets | Plist additions, Gradle snippets, Fastlane files |

Other directories at root (`superpowers/`, `claude-mem/`, `awesome-claude-code-subagents/`, `kimi super admin dashboard /`, `autopilot-preview/`, `autopilot-web-preview/`) are **third-party tools, plugins, or prototypes**. Do not edit them unless explicitly asked.

---

## 2. Technology Stack

### 2.1 Web App (`saas_development/`)

- **Framework**: Next.js 16.1.1 (App Router)
- **UI**: React 19.2.3, Tailwind CSS v4, `lucide-react`, `framer-motion`, `recharts`, `chart.js`
- **State / Data**: Supabase (`@supabase/supabase-js`, `@supabase/ssr`, auth-helpers), Auth0 (`@auth0/auth0-react`)
- **Forms**: `react-hook-form` + `zod`
- **PWA / Offline**: `serwist/next` (service-worker generation)
- **Build target**: Vercel (see `vercel.json`)

### 2.2 Mobile App (`saas_mobile/`)

- **Framework**: Expo SDK 54, React Native 0.81.5, React 19.1.0
- **Router**: Expo Router ~6.0.0 (file-based)
- **State**: Zustand 5.x, React Context, MMKV + AsyncStorage for persistence
- **Backend**: Supabase (`@supabase/supabase-js`)
- **Forms**: `react-hook-form` + `zod`
- **UI / Animation**: `react-native-reanimated` ~4.1.0, `react-native-gesture-handler`, `@gorhom/bottom-sheet`, `lucide-react-native`, `victory-native`
- **Media**: `expo-camera`, `expo-image-picker`, `expo-av`, `expo-media-library`
- **Push**: `expo-notifications`, `@notifee/react-native`
- **Build target**: EAS (Expo Application Services) — see `eas.json`

---

## 3. Code Organization

### 3.1 Web App (`saas_development/`)

```
saas_development/
├── app/                         # Next.js App Router
│   ├── (dashboard)/[orgId]/     # Org-scoped authenticated pages
│   ├── onboarding/              # Onboarding flow
│   ├── privacy/ / terms/        # Static legal pages
│   ├── layout.tsx               # Root layout (fonts, providers, SW registration)
│   └── page.tsx                 # Landing / home
├── frontend/
│   ├── components/              # React components (by feature)
│   │   ├── ui/                  # Shared primitives (buttons, inputs, etc.)
│   │   ├── tickets/             # Ticket-specific components
│   │   ├── dashboard/           # Dashboard widgets
│   │   ├── auth/                # Auth flows
│   │   └── ...
│   ├── context/                 # React contexts (Auth, Theme, Global, DataCache)
│   ├── hooks/                   # Custom hooks
│   ├── utils/                   # Utilities
│   └── types/                   # Frontend TypeScript types
├── backend/
│   ├── services/                # Server-side services
│   │   ├── authService.ts
│   │   ├── NotificationService.ts
│   │   ├── EmailService.ts
│   │   ├── WhatsAppService.ts
│   │   └── ...
│   ├── lib/                     # Backend helpers (LLM, Supabase, ticketing, WhatsApp)
│   ├── db/
│   │   ├── migrations/          # Supabase SQL migrations
│   │   └── schema/              # Schema definitions
│   └── scripts/                 # One-off backend scripts
├── lib/                         # Shared cross-boundary helpers
│   ├── database.types.ts
│   └── mcp-client.ts
├── docs/                        # Implementation plans, walkthroughs, performance docs
├── next.config.ts
├── tsconfig.json
└── package.json
```

**Path aliases (web)** — defined in `tsconfig.json`:
- `@/*` → `./*`
- `@frontend/*` → `./frontend/*`
- `@backend/*` → `./backend/*`
- `@components/*` → `./frontend/components/*`
- `@hooks/*` → `./frontend/hooks/*`
- `@services/*` → `./backend/services/*`

### 3.2 Mobile App (`saas_mobile/`)

```
saas_mobile/
├── app/                         # Expo Router file-based routes
│   ├── (app)/                   # Authenticated routes
│   │   ├── (admin)/             # Admin-only screens
│   │   ├── tickets/             # Ticket management
│   │   ├── visitors/            # Visitor management (VMS)
│   │   ├── stock/               # Inventory / stock
│   │   ├── sops/                # SOP management
│   │   ├── meeting-rooms/       # Meeting room booking
│   │   ├── properties/          # Property list
│   │   ├── _layout.tsx          # Tab layout
│   │   ├── index.tsx            # Dashboard
│   │   └── more.tsx             # More menu
│   ├── (auth)/                  # Unauthenticated routes
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   ├── forgot-password.tsx
│   │   └── onboarding.tsx
│   ├── _layout.tsx              # Root layout
│   └── +not-found.tsx           # 404
├── components/                  # React Native components (NOT under src/)
│   ├── ui/                      # Shared primitives (Text, Button, Input, Card, etc.)
│   ├── tickets/                 # Ticket-specific
│   ├── dashboard/               # Dashboard widgets
│   └── ... (feature folders)
├── hooks/                       # Custom hooks
├── context/                     # React contexts
├── services/                    # API service classes
│   ├── authService.ts
│   ├── ticketService.ts
│   ├── userService.ts
│   ├── propertyService.ts
│   ├── vmsService.ts
│   ├── stockService.ts
│   ├── sopService.ts
│   ├── meetingRoomService.ts
│   └── reportService.ts
├── store/                       # Zustand stores
├── lib/                         # Utility functions
├── types/                       # TypeScript types
├── utils/                       # Additional helpers
├── assets/
│   ├── fonts/                   # Poppins + Urbanist
│   └── images/                  # Icons, splash, adaptive icons
├── app.json                     # Expo config
├── eas.json                     # EAS build config
└── package.json
```

**Note**: The mobile project does **not** use a `src/` directory for components — they live at `components/` directly under `saas_mobile/`.

---

## 4. Build & Development Commands

### 4.1 Web App (`saas_development/`)

```bash
cd saas_development

# Install dependencies
npm install

# Development server (uses webpack because of serwist)
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
- There are **no unit-test files** currently present in `saas_development/`.
- Linting is the primary automated gate: `npm run lint`.

### 5.2 Mobile App
- Test runner: **Jest** + `jest-expo` + `@testing-library/react-native`.
- Run tests: `cd saas_mobile && npm test`
- No test files exist yet in the current tree — this is a known gap in the migration.

### 5.3 General Testing Philosophy
The `superpowers/` plugin (if active in your agent environment) enforces **red-green TDD** via the `test-driven-development` skill. If you are adding features, follow that workflow when it triggers.

---

## 6. Code Style & Conventions

### 6.1 TypeScript
- **Strict mode is enabled** in both projects.
- Prefer `interface` over `type` for object shapes unless union types are required.
- Use explicit return types on public service methods.

### 6.2 Imports
- Use the path aliases listed above. Do not use deep relative paths like `../../../../components` when an alias exists.
- Mobile uses `babel-plugin-module-resolver` for aliases.

### 6.3 Styling
- **Web**: Tailwind CSS v4 utility classes. Custom theme tokens (colors, fonts) are defined in globals / Tailwind config.
- **Mobile**: React Native `StyleSheet` objects. Brand colors:
  - Primary: `#708F96` (Slate Blue-Green)
  - Secondary: `#AA895F` (Warm Tan/Gold)
- Typography:
  - Display: **Poppins**
  - Body: **Urbanist**

### 6.4 State Management
- **Web**: React Context for global auth/theme; local `useState` for form state; no Redux.
- **Mobile**: Zustand for auth, notifications, and UI state; React Context for theme/auth wrapper; TanStack Query is listed in the README but verify actual usage before adding new query logic.

### 6.5 Backend / Database
- Primary database is **Supabase** (PostgreSQL).
- Migrations live in `saas_development/backend/db/migrations/`. Name them with a datetime prefix, e.g. `20260311_escalation_hierarchy.sql`.
- Server-side business logic (notifications, WhatsApp, email) lives in `saas_development/backend/services/`.

### 6.6 API Routes / Cron Jobs (Web)
The web app defines Vercel cron jobs in `vercel.json`:
- `/api/cron/check-sop-reminders` (every minute)
- `/api/cron/check-sla` (every minute)
- `/api/cron/check-escalation` (every minute)
- `/api/cron/daily-whatsapp-report` (18:30 daily)
- `/api/cron/ppm-reminders` (03:30 daily)
- and others.

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
Copy `saas_mobile/.env.example` to `saas_mobile/.env` and fill:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Expo requires the `EXPO_PUBLIC_` prefix for variables to be exposed to the client bundle.

### 7.3 Deployment / Shared
A generic deployment template lives at `config/.env.example`. It covers Firebase, Apple/Google signing, Fastlane, Stripe, Sentry, etc. This is **mostly for CI/CD and store submission** rather than local development.

---

## 8. Security Considerations

- **Never commit `.env` files** — they are gitignored in both projects.
- The web root layout performs an **aggressive service-worker purge** on first load (see `saas_development/app/layout.tsx`). If you change caching strategy, be aware of the deep-purge logic.
- Supabase RLS policies should be reviewed before exposing new tables.
- Certificate pinning and JWT secrets are referenced in `config/.env.example` but are not actively enforced in local dev.

---

## 9. Deployment

### 9.1 Web
- Target platform: **Vercel**.
- Build command: `next build --webpack` (required because `serwist` injects a webpack plugin).
- Cron jobs run as Vercel Serverless Functions.

### 9.2 Mobile
- Build pipeline: **EAS** (`eas build`).
- Profiles: `development`, `preview`, `production` (see `eas.json`).
- iOS bundle ID: `com.autopilot.app`
- Android package: `com.autopilot.app`
- Store submission assets are prepared in `ios-config/`, `android-config/`, and `fastlane-config/` at the repo root.

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
3. **Path aliases?** Use `@components`, `@frontend`, `@services`, etc. on web; use relative or alias imports on mobile.
4. **Strict TS?** Both projects enforce strict mode — fix type errors before declaring done.
5. **Test?** If you add logic, add a Jest test (mobile) or verify via lint/build (web).
6. **Migration?** If you change the DB schema, place a migration in `saas_development/backend/db/migrations/` with a datetime prefix.

---

_Last updated: 2026-04-16_
