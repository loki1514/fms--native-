# Contributing

## Branch strategy

| Branch | Purpose |
|---|---|
| `main` | Production-ready. Protected — no direct pushes. |
| `develop` | Integration branch. All features merge here first. |
| `feat/<name>` | New feature work |
| `fix/<name>` | Bug fixes |
| `infra/<name>` | CI/CD, build, deployment changes |
| `db/<name>` | Database migration-only changes |

## Where to work

| What you're changing | Directory |
|---|---|
| Mobile app screens, components, hooks | `apps/mobile/` |
| Web dashboard | `apps/web/` |
| Cassandra AI logic, tools, prompts | `services/cassandra/` |
| SQL schema, RPC functions | `database/migrations/` |
| iOS/Android build config | `infra/ios/` or `infra/android/` |
| CI pipelines | `infra/fastlane/` |
| Architecture decisions | `docs/architecture/` |

## Never do this

- ❌ Import from `tools/` into `apps/` or `services/`
- ❌ Commit `.env` files
- ❌ Add scratch/test scripts to `apps/mobile/` root — use `archive/mobile-scratch/` or a `__tests__/` dir
- ❌ Put Python backend code inside `apps/mobile/`
- ❌ Put SQL migrations inside `apps/`

## Code style

- **TypeScript strict** — no `any` without a comment explaining why
- **Expo/RN:** Follow the existing `@/` alias convention (`tsconfig.json` paths)
- **Python:** Black formatter, type hints on all public functions

## PR checklist

- [ ] `tsc --noEmit` passes with no new errors
- [ ] No console.logs left in committed code
- [ ] New Cassandra features tested in `services/cassandra/` independently
- [ ] DB schema changes have a migration file in `database/migrations/`
- [ ] `CONTRIBUTING.md` updated if you changed a convention
