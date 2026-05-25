# Autopilot — Monorepo

Facilities & property management SaaS platform.

---

## Repo structure

```
autopilot/
│
├── apps/
│   ├── mobile/          Expo React Native app (iOS + Android + Web)
│   └── web/             React/Vite web dashboard
│
├── services/
│   └── cassandra/       Cassandra AI assistant — FastAPI (Python)
│
├── database/
│   ├── migrations/      Supabase SQL migrations (run in order)
│   └── seeds/           Dev seed data
│
├── infra/
│   ├── android/         Android build config (AndroidManifest, Gradle)
│   ├── ios/             iOS config (Info.plist, entitlements)
│   ├── fastlane/        Fastlane CI/CD lanes
│   └── preview/         Tunnel preview server
│
├── docs/
│   ├── architecture/    Cassandra AI design decisions & plans
│   ├── planning/        Feature plans, audits, readiness reports
│   ├── deployment/      App Store & deployment guides
│   └── legal/           Privacy policy & ToS templates
│
├── tools/               ⚠️  External dev tools (gitignored — NOT product code)
│   ├── agent-browser/   Browser automation scripts
│   ├── awesome-claude-code-subagents/
│   ├── claude-mem/
│   ├── impeccable/
│   └── superpowers/
│
└── archive/             ⚠️  Old builds, tarballs, scratch (gitignored)
```

---

## Quick start

### Mobile app
```bash
cd apps/mobile
npm install
npx expo start
```

### Web dashboard
```bash
cd apps/web
npm install
npm run dev
```

### Cassandra AI backend
```bash
cd services/cassandra
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000
```

### Database
```bash
supabase db push   # applies database/migrations/ in order
```

---

## Environment variables

Each app has its own `.env` (never committed). Copy from `.env.example` in each dir.

| App | Key variables |
|---|---|
| `apps/mobile` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_CASSANDRA_API_URL` |
| `apps/web` | `NEXT_PUBLIC_SUPABASE_URL` |
| `services/cassandra` | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY` |

---

## Architecture

```
  apps/mobile  ──────────────────┐
  apps/web     ────────────────┐ │
                               ▼ ▼
                         Supabase (Postgres + Auth + Storage)
                               │
                               └──▶  services/cassandra  (Cassandra AI)
                                         │
                                         └──▶  OpenAI API
```

Cassandra receives a user message + optional `property_id` scope and streams
back SSE tokens. See [`services/cassandra/README.md`](services/cassandra/README.md).

---

## Key concepts

| Term | Meaning |
|---|---|
| **Property** | A physical building/site the platform manages |
| **Org** | An organisation that owns/manages multiple properties |
| **MST** | Maintenance Soft Tech — field technician role |
| **Super Tenant** | Tenant user scoped to multiple properties (HQ contact) |
| **Cassandra** | AI assistant embedded in web + mobile that queries property data |

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for branch strategy, code style, and PR rules.

---

## Tools directory

`tools/` contains third-party developer tools cloned locally. They are
**gitignored** — each has its own upstream repo. Do not import from `tools/`
into any `apps/` or `services/` code.

| Tool | Purpose | Upstream |
|---|---|---|
| `claude-mem` | Claude Code memory layer | github.com/... |
| `superpowers` | Claude Code skill extensions | github.com/... |
| `awesome-claude-code-subagents` | Subagent library | github.com/... |
| `impeccable` | Code quality harness | github.com/... |
| `agent-browser` | Local browser automation for QA | internal |
