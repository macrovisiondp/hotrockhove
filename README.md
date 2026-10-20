# Hot Rock Hove: website and admin

Replacement for the WordPress site at https://hotrockhove.com/: a Next.js website with its own admin dashboard. The WordPress site stays live until the owner approves cutover.

**Status:** the website and admin are built and tested locally; production setup (Vercel, Neon, Resend, Amazon S3) is pending. See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

| Read this | For |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | Running it locally |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it's built and why |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Environment variables, migrations, DNS, cutover, rollback |
| [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | Using the admin (for staff) |
| [docs/CONTENT_MIGRATION_REPORT.md](docs/CONTENT_MIGRATION_REPORT.md) | What was migrated, flagged or changed |
| [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) | Outstanding decisions, access needed, known limitations |
| [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md) | Latest test run |
| [docs/WEBSITE_AUDIT.md](docs/WEBSITE_AUDIT.md) and other audit docs | Phase 1 audit of the WordPress site |

```bash
npm install && cp .env.example .env.local   # fill in secrets (see SETUP.md)
npm run dev:reset && npm run dev
```
