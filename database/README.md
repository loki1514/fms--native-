# Database

Supabase (PostgreSQL) — all schema, migrations, and seed data live here.

## Structure

```
database/
├── migrations/     ← SQL files applied via Supabase CLI (run in filename order)
├── seeds/          ← Dev seed data scripts
└── README.md
```

## Applying migrations

```bash
# Using Supabase CLI (from repo root)
supabase db push

# Or manually (psql)
psql $DATABASE_URL -f database/migrations/20260514_phase1_dashboard_intelligence.sql
```

## Migrations log

| File | Description |
|---|---|
| `20260514_phase1_dashboard_intelligence.sql` | Dashboard RPC functions — Phase 1 |
| `20260514_phase2_ticket_intelligence.sql` | Ticket intelligence RPC functions — Phase 2 |
| `20260514_rpc_functions_only.sql` | RPC-only subset (lightweight deploy) |
| `20260514_all_rpc_functions_final.sql` | Combined final — use for fresh installs |

## Connection

All apps connect via Supabase client libs. Set the following in each app's `.env`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server/backend only
```
