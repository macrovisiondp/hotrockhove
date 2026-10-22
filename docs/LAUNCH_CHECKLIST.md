# Launch Checklist and Outstanding Issues

Live status is on the admin **Dashboard → Launch readiness**, which checks real configuration. This page lists what can't be checked automatically, plus decisions only the owner can make.

## A. Owner decisions and information needed

| # | Item | Where | Blocks launch? |
|---|---|---|---|
| 1 | Confirm phone, public email and address | Admin → Business settings | Yes |
| 2 | Confirm opening hours (old site had three versions) | Business settings | Yes |
| 3 | Which inbox receives enquiries (`info@` or `hello@hotrockhove.com`) | Email & notifications | Yes |
| 4 | Official Instagram for Hove (current link is `hotrock_portsmouth`) | Business settings | Review |
| 5 | Review the privacy policy draft (ideally with legal advice), then clear its review note | Pages → Privacy Policy | Yes |
| 6 | Publish fan-club prize-draw terms ("T + C's Apply") or remove that line | Pages / Daisy | Yes (legal) |
| 7 | Menu review notes (5 items) and offer notes (3) | Menu, Offers | Review |
| 8 | Image rights: 8 theme stock photos + 1 video unconfirmed; confirm the random-named food photos are Hot Rock's own | Media | Review |
| 9 | About Us: approve the draft (verified founder text only) or supply new copy | Pages → About Us | No (302 to /wagyu meanwhile) |
| 10 | 360° tour: switched on at the owner's request (2026-10-22); it's a render hosted on vr.3d66.com, labelled "RonGroup" | Site settings → 3D tour | No |
| 10a | Homepage sizzle sound: a 45 s cut of the old site's track, which appears to be ripped from a YouTube video (Applebee's ASMR). Replace it with a licensed sound (the moo is a Pixabay-style file) | Site settings → Homepage sounds | Review (rights) |
| 11 | Old submissions (~441) and the 271 newsletter addresses: archive or import as legacy | MIGRATION_PLAN §2 | No |
| 12 | Re-permission email to legacy subscribers | Needs separate approval | No |
| 13 | Booking-system URL (separate project) | Business settings | No (form fallback) |
| 14 | Trustindex widget script URL (Google reviews) | Site settings | No |
| 15 | Vercel plan (Pro for commercial use) and any paid upgrades | Owner | Yes, before production |

## B. Access and credentials still needed

| Need | For |
|---|---|
| Vercel account / team access | Preview and production deployments |
| Neon project | Production database (`DATABASE_URL`) |
| Resend account + API key | Email (owner pastes it in Admin → Email) |
| Hostinger hPanel DNS access (or someone to apply records) | Resend DKIM, then the domain cutover |
| Cloudflare Turnstile keys | Form bot protection |
| Trustindex account | Reviews widget |
| Rank Math redirects export from WordPress (couldn't be read: HTTP 403) | Confirm no other old URLs need redirects |
| Microsoft 365 / `hotrocksteaks.com` status | Only to understand the old mail setup; not needed for the new site |

## C. Technical items before production

- [ ] Neon database created, `0000_init.sql` applied, seeded, `pre-launch` branch taken (DEPLOYMENT §3)
- [x] Neon database migrated and seeded; 85 media files imported to the Neon bucket `hotrockhove` (2026-10-21)
- [x] Neon bucket `hotrockhove` is **public_read** (2026-10-22: backed up, deleted, recreated public and restored to the same keys, as neither the CLI, API nor `neon deploy` can change an existing bucket's access); 86/86 objects verified against the backup; storage **Test now** passes
- [ ] Poster images chosen for gallery videos; the 106 MB video ideally compressed
- [ ] Production owner account created; dev account never created in production
- [ ] Resend domain verified; test email received; delivery switched on
- [ ] Turnstile keys set; a form tested with the widget
- [ ] `CRON_SECRET` set; retention cron visible in Vercel
- [ ] Preview e2e run green; manual check at 375 / 768 / 1280 / 1440 px
- [ ] Indexing switched on at cutover (not before)
- [ ] Known advisory: `npm audit --omit=dev` reports 4 moderate findings, all one chain: `drizzle-kit` → `@esbuild-kit` → `esbuild@0.18` ([GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99), esbuild's *development server* can be read by other sites). `drizzle-kit` is a dev tool, counted as production only because `better-auth` lists it as an optional peer. The app never runs esbuild's server. The suggested `audit fix --force` would downgrade drizzle-kit to 0.18 (breaking); update when drizzle-kit ships a fix

## D. Known limitations

- Pages render per request (required for the nonce-based Content Security Policy). Data is cached and invalidated on save, so this is fast, but pages aren't served from the CDN cache.
- Redirect, maintenance and tour-embed changes reach the edge within about 60 seconds (per-instance cache in the proxy).
- The admin preview shows page content without the site header and footer.
- S3 doesn't generate video posters; choose a poster image per video in Media.
- With S3, images are optimised by the website (Next.js) rather than by a media service; with heavy traffic a CloudFront CDN is worthwhile.
- Seasonal pages (Valentine's) need their dates and copy updated before republishing.
