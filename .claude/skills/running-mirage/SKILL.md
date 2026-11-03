---
name: running-mirage
description: Use when starting, restarting, seeding, resetting or troubleshooting the MIRAGE app locally — dev server won't start, port 3000 busy, Prisma client errors, empty catalog, login fails with demo accounts.
---

# Running MIRAGE

## Commands (run from repo root, Windows / Git Bash or PowerShell)
| Goal | Command |
|---|---|
| Install | `npm install` |
| Create/upgrade DB | `npx prisma migrate dev` |
| Seed demo catalog + accounts | `npm run db:seed` |
| Full reset (wipes DB) | `npx prisma migrate reset --force` (runs seed) |
| Dev server | `npm run dev` → http://localhost:3000 (run in background) |
| Typecheck | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Tests | `npm test` (vitest) |
| Prod build check | `npm run build` |

## Demo accounts (created by seed, password `mirage123`)
- `admin@mirage.tv` — ADMIN (admin panel `/admin`)
- `creator@mirage.tv` — CREATOR (studio `/studio`)
- `viewer@mirage.tv` — VIEWER with 120 coins

## Env (`.env`, copy from `.env.example`)
`DATABASE_URL="file:./dev.db"`, `SESSION_SECRET` (any long string), `ALLOW_MOCK_PAYMENTS=1`.

## Troubleshooting
- **Port in use** (PowerShell): `Get-NetTCPConnection -LocalPort 3000 | % { Stop-Process -Id $_.OwningProcess -Force }`
- **`@prisma/client did not initialize` / EPERM on query engine**: stop the dev server, then `npx prisma generate`.
- **Empty home page**: seed not run → `npm run db:seed`.
- **Uploaded videos 404**: files live in `storage/` (git-ignored), served via `/api/stream/...`, not `public/`.

To check the result visually → REQUIRED: verifying-ui-in-browser.
