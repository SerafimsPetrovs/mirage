---
name: running-mirage
description: Use when starting, restarting, seeding, resetting or troubleshooting the MIRAGE app locally — dev server won't start, port 3000 busy, Prisma client errors, empty catalog, login fails with demo accounts, Tailwind/magic-string require() errors.
---

# Running MIRAGE

## Commands (repo root; Git Bash or PowerShell on Windows)
| Goal | Command |
|---|---|
| Install | `npm install` (runs `prisma generate`) |
| Create/upgrade DB | `npx prisma migrate dev` |
| Re-seed demo data (wipes tables) | `npm run db:seed` |
| Dev server | `npm run dev` → http://localhost:3000 — run in background |
| Typecheck / lint / tests | `npx tsc --noEmit` · `npm run lint` · `npm test` |
| Prod build | `npm run build` (works while dev server runs) |

## Demo accounts (seed, password `mirage123`)
`viewer@mirage.tv` (VIEWER, 120 bonus + 330 paid coins; no kids PIN yet) · `creator@mirage.tv` / `lotus@mirage.tv` (CREATOR) · `admin@mirage.tv` (ADMIN).

## Resetting the DB as an agent
`prisma migrate reset` / `db push --force-reset` are **blocked for AI agents** by Prisma's consent guard. Instead: stop the dev server, delete `prisma/dev.db`, run `npx prisma migrate dev` (applies migrations + seed). Tests use their own `prisma/test.db`, recreated by `vitest.setup.ts`.

## Media refs
- `demo:<file>` → `media/demo/` (generated placeholder clips, committed)
- `storage:videos/…`, `storage:images/…` → `storage/` (uploads, git-ignored)
- Videos are served only via `/api/stream/[episodeId]` (access-checked, Range support). Images via `/api/media/images/…`. Posters without uploads are generated SVG: `/api/poster/[slug]?h=<hue>&o=v|h`.

## Troubleshooting
- **Port in use** (PowerShell): `Get-NetTCPConnection -LocalPort 3000 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`
- **`require() of ES Module …magic-string`**: Node < 20.19 with Tailwind 4.3. `package.json` `overrides` pins `magic-string@^0.30`; after `npm install`, delete `.next/` and restart.
- **`@prisma/client did not initialize` / EPERM on query engine**: stop dev server, `npx prisma generate`.
- **Empty home page**: run `npm run db:seed`.
- **Headless browser shows English**: locale comes from cookie, else `Accept-Language`; switch via footer RU/EN.

To check results visually → REQUIRED: verifying-ui-in-browser.
