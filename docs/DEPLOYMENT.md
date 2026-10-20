# Deployment, Configuration and Rollback

**Nothing here has been run against production yet.** Every step that touches DNS, the live domain or paid services needs the owner's approval first.

## 1. Services

| Service | Purpose | Plan | Who owns the account |
|---|---|---|---|
| Vercel | Hosting, previews, cron | Hobby works for testing; Pro is needed for commercial use (owner decision, recurring cost) | Owner |
| Neon | Postgres database | Free tier is enough for this data volume | Owner |
| Resend | Transactional email | Free tier (a few thousand emails a month, with a daily cap; confirm current limits on resend.com/pricing) | Owner |
| Cloudinary | Images and video | Free: 25 credits/month (see Admin → Media → Storage settings) | Owner |
| Cloudflare Turnstile | Bot protection on forms | Free | Owner |

## 2. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** connection string (`…-pooler…/neondb?sslmode=require`). Use a separate Neon branch for Preview |
| `APP_URL` | yes | `https://hotrockhove.com` (Production) or the preview URL |
| `BETTER_AUTH_SECRET` | yes | 32+ random bytes, base64. Different per environment |
| `SETTINGS_ENCRYPTION_KEY` | yes | 32 random bytes, base64. **Store a copy in a password manager**: losing it means re-entering every API key in the admin |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | recommended | From Cloudflare Turnstile (widget for hotrockhove.com + preview domain) |
| `CRON_SECRET` | yes | Random string; Vercel sends it to `/api/cron/retention` |
| `RESEND_API_KEY` | optional | Fallback only. Normally the owner pastes the key in Admin → Email |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | if preview protection is on | Lets the proxy read its own routing data on protected previews |
| `ALLOW_LOCAL_STORAGE` | never on Vercel | Refused automatically |

Never commit real values. `.env.example` has placeholders only.

## 3. Database migrations

| Question | Answer |
|---|---|
| Is a migration required before deploying? | **Yes**, on a new Neon database: `drizzle/0000_init.sql` (creates all tables) |
| Exact file | `drizzle/0000_init.sql` (journal: `drizzle/meta/_journal.json`) |
| Tested? | Yes, applied repeatedly to PGlite (Postgres 17) by `npm run dev:reset`; the app and e2e suite ran against it. **Not yet run on Neon.** |
| Safe order | 1. Create Neon project and branch → 2. `DATABASE_URL=… npm run db:migrate` → 3. `npm run db:seed` → 4. configure Cloudinary in the admin, then `npm run media:import` → 5. `npm run db:seed -- --force=pages,offers,popups,menu` (fresh DB only) → 6. `npm run admin:create -- --email … --role owner` → 7. deploy |
| Backward compatible? | Not applicable: no earlier version of this app is deployed. Future migrations must be additive (new tables/columns with defaults) so the running version keeps working during deploys |
| Backup / rollback | Neon keeps point-in-time history; take a named branch (`pre-launch`) before seeding production. Rolling back the database = restore that branch. The WordPress site is untouched and remains the rollback for the website |

Run migrations from a trusted machine with the production `DATABASE_URL` in the shell only (not saved to disk), or through a one-off Vercel deployment command. Never run `--force` seeds against a database that already has real edits: they replace page and menu content.

## 4. Email (Resend) DNS (needs owner approval: DNS change)

1. Resend → Domains → add `hotrockhove.com` (or `send.hotrockhove.com`).
2. Add the records Resend shows at Hostinger DNS (hPanel): a DKIM TXT (`resend._domainkey`) and the return-path MX + SPF TXT on the `send` subdomain.
3. **Do not change** the existing `MX` (Hostinger mailboxes) or root SPF (`include:_spf.mail.hostinger.com`).
4. DMARC exists as `p=none` without reporting. Add `rua=mailto:dmarc@hotrockhove.com` (or a reporting service); move to `p=quarantine` after 2–4 clean weeks.
5. Admin → Email: provider Resend, sender `no-reply@hotrockhove.com` (or similar), reply-to the confirmed inbox, paste the API key (owner), **send a test**, then switch delivery on.

The old WP Mail SMTP Outlook connection (expired Azure secret, sender on the non-existent `hotrocksteaks.com`) is **not** carried over.

## 5. Vercel project

1. Import the GitHub repository; framework Next.js; Node 22.
2. Set the environment variables (Production and Preview separately).
3. **Production branch:** `main`. Feature branches create Preview deployments only. A push to `main` deploys production, so merge only after approval.
4. `vercel.json` registers the daily retention cron (03:30 UTC).
5. Deployment Protection on previews is recommended (set `VERCEL_AUTOMATION_BYPASS_SECRET`).
6. After each deploy, check the deployment status and URL in Vercel. A successful `git push` is not proof of a successful deployment.

## 6. Preview review (before any DNS change)

On the preview URL:

- Sign in, run through [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md) and the dashboard's launch-readiness list.
- `E2E_BASE_URL=https://<preview> npm run test:e2e` (needs a dev owner on that database; don't run it against production data).

## 7. Cutover (owner approval required at each step)

1. All dashboard **blockers** resolved; owner signs off design, copy, menu and prices.
2. Neon: create branch `pre-launch` (backup).
3. Admin → SEO: switch **indexing on**.
4. Lower the TTL on the `A`/`CNAME` records for `hotrockhove.com` and `www` to 300 s, a day ahead.
5. Add `hotrockhove.com` and `www.hotrockhove.com` in Vercel; change **only** the `A`/`CNAME` records at Hostinger as Vercel instructs. **Leave MX, SPF, DKIM and DMARC untouched.**
6. Wait for TLS; smoke test: home, menu, contact form (real submission → notification arrives), newsletter confirm email, `/our-menus/` → 301, `/service/wedding/` → 410, `/sitemap.xml`, `/robots.txt`.
7. Google Search Console: submit `/sitemap.xml`; watch for 404s and add redirects in the admin.

## 8. Rollback

| Problem | Action |
|---|---|
| Site broken after cutover | Restore the previous Hostinger `A`/`CNAME` records (WordPress is untouched). Propagation follows the lowered TTL |
| Bad deploy | Vercel → Deployments → previous deployment → "Promote to Production" |
| Bad data change | Restore the Neon `pre-launch` branch (or point-in-time) |
| Email problems | Admin → Email → switch delivery off (submissions are still saved) |

Keep WordPress running on Hostinger for at least 30 days after cutover. Then export its database and uploads as an archive before the owner decides on decommissioning.
