# Local Development Setup

## Requirements

- Node.js 22+, npm 10+
- No database server needed locally: development uses **PGlite** (embedded Postgres in `.data/pglite`).

## First run

```bash
npm install
cp .env.example .env.local        # then fill in the two secrets below
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # BETTER_AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # SETTINGS_ENCRYPTION_KEY
```

In `.env.local` also set:

```
ALLOW_LOCAL_STORAGE=true          # media on local disk (.data/media) instead of S3
DEV_ADMIN_EMAIL=owner@hotrockhove.test
DEV_ADMIN_PASSWORD=<12+ random characters>
```

Then build the local database with the migrated content:

```bash
npm run dev:reset     # migrate → seed → import media from hotrockhove.com → re-seed → create the dev owner
npm run dev           # http://localhost:3000 ; admin at /admin
```

`dev:reset` downloads about 230 MB of media from the live WordPress site the first time (cached in `.data/media-staging`).

## Important: one process at a time (PGlite)

PGlite is a single-process database. **Stop `npm run dev` before running any script** (`db:seed`, `media:import`, `admin:create`) and start it again afterwards. Two processes opening `.data/pglite` at once can corrupt it. If that happens, run `npm run dev:reset`.

Scripts can't clear the running server's data cache. After seeding, run `npm run cache:clear` and restart the dev server.

Don't redirect dev-server logs into the project folder (e.g. `> .data/dev.log`). The file watcher picks up every write and reloads the page in a loop.

## Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` · `npm run lint` | Type check · ESLint |
| `npm test` | Unit tests (node:test) |
| `npm run test:e2e` | Playwright end-to-end tests (starts the dev server on port 3100 if needed) |
| `npm run db:generate` | Create a SQL migration from changes to `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (PGlite locally, Neon when `DATABASE_URL` is set) |
| `npm run db:seed` | Seed migrated content; existing rows are kept. `-- --force=pages,menu,…` replaces groups |
| `npm run media:import` | Import WordPress media into the active storage provider (repeatable, de-duplicated) |
| `npm run admin:create -- --email x@y --name "Name" --role owner` | Create an admin account or reset its password |
| `npm run dev:reset` | Rebuild the local database from scratch |
| `npm run cache:clear` | Clear Next.js's data cache (after scripts) |

## Project layout

```
src/app/(site)/        public pages (layout, [slug], newsletter confirm/unsubscribe)
src/app/admin/         admin: login, (panel)/… modules, preview, CSV exports
src/app/api/           popup events, cron retention, internal routing, admin media search
src/components/site/   public UI (header, footer, sections, forms, consent, pop-ups)
src/components/admin/  admin UI (forms, media picker, section editor, field editor)
src/domain/            content queries, sections, forms, newsletter, migration helpers
src/lib/               auth, RBAC, settings, crypto, email, storage, rate limits, CSP, audit
src/db/                Drizzle schema + client
drizzle/               SQL migrations (committed)
scripts/               migrate, seed, media import, create-admin, screenshots
tests/unit · tests/e2e unit and Playwright tests
docs/                  audit, plans, guides, reports
```
