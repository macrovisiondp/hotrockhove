# Architecture (proposed — confirm before build)

The audit found no compatibility issue with the recommended stack. The choices below also match the owner's other projects (Recruitment-hotrock, Sonny's), so they can share operational knowledge.

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), React, TypeScript strict | Server components, ISR, metadata API, Vercel-native |
| Styling | Tailwind CSS v4 + design tokens in CSS variables | Tokens editable (brand colours) without a rebuild |
| UI primitives | Radix-based accessible components (dialog, menu, tabs), custom-styled | Accessibility without a template look |
| Database | Neon Postgres (dev branch / preview branch / prod) | Managed, branching per preview |
| ORM / migrations | Drizzle ORM + drizzle-kit SQL migrations (additive, committed) | Already used in the owner's other projects; plain SQL migrations to review before deploy |
| Auth | Better Auth (email + password, optional TOTP) with DB sessions | Established library; RBAC in our own tables |
| Email | Resend via an `EmailProvider` adapter; SMTP adapter (Nodemailer) | See INTEGRATIONS_AND_EMAILS |
| Media | `StorageProvider` adapter; Cloudinary default (D6) | Image/video transforms and CDN |
| Spam | Cloudflare Turnstile + honeypot + per-IP/per-form rate limit (Postgres-backed) | No extra service |
| Validation | Zod schemas shared by forms, server actions and API routes | One source of truth |
| Rich text | Constrained structured blocks (heading, paragraph, image, video, CTA, menu reference, offer list, gallery). Paragraph text = limited Markdown, sanitised on render | No arbitrary HTML |
| Hosting | Vercel (preview per branch, production on `main` after approval) | — |
| Tests | Vitest (unit/integration), Playwright (E2E + axe accessibility), Lighthouse CI | — |

## 2. Layout

```
src/
  app/
    (site)/            public pages: /, /our-menus, /daisy, /gallery, /contact, /wagyu, [slug]
    admin/             dashboard (server-rendered, auth-gated)
    api/               form submit, newsletter confirm/unsubscribe, popup events, health
    sitemap.ts robots.ts
  components/          ui/ (primitives)  site/ (nav, footer, hero, menu, gallery, popup)  admin/
  domain/              pages, menu, offers, forms, newsletter, popups, settings, media, redirects, audit
  db/                  schema.ts, migrations/, client.ts
  adapters/            email/{resend,smtp}  storage/{cloudinary,blob}  captcha/turnstile
  lib/                 auth, rbac, crypto (AES-256-GCM), rate-limit, env (zod-validated)
middleware.ts          redirects, maintenance mode, admin gate
scripts/import/        menu, pages, media, redirects (idempotent)
```

Presentation never calls Drizzle directly. It calls `domain/*` services, which enforce permissions server-side.

## 3. Data model (initial)

- `user`, `session`, `account` (Better Auth) + `role` on user: `owner`, `admin`, `editor`, `viewer`
- `site_settings` (single row, versioned): business info, hours (structured), socials, Book Table URL, SEO defaults, analytics ID, consent config, announcement banner, maintenance flag, feature flags
- `integration_secret` (provider, key name, ciphertext, iv, tag, last4, updatedBy)
- `page` (slug, status draft/published/scheduled, seo fields) · `page_revision` · `page_section` (type, order, json validated by Zod per type)
- `nav_item` (location header-left/header-right/footer/mobile, label, href/pageId, order, visible)
- `menu_category` · `menu_item` (name, description, featured, visible, image) · `menu_item_price` (label, amount_pence, raw_label) · `allergen` (only when verified)
- `offer` (title, copy, price, code, weekdays, starts/ends, visible)
- `media_asset` (provider id, url, filename, mime, bytes, w/h, checksum, alt, caption) · `media_usage`
- `form` (key, fields json, messages, recipients, ack template, consent text, retention days) · `form_submission` (data json, status, ip hash, created) — admin-only
- `newsletter_subscriber` (email, status pending/subscribed/unsubscribed/legacy_unconfirmed, consent text + timestamp, tokens)
- `popup` (template, content, CTA, form key, pages, trigger type/delay/scroll, frequency, schedule, enabled) · `popup_event` (impression/dismiss/convert, aggregated daily)
- `email_template` · `email_log` (no bodies)
- `redirect` (from, to, code, hits)
- `audit_log` (actor, action, entity, before/after diff with secrets redacted)

## 4. Rendering and performance

- Public pages: static with on-demand revalidation (`revalidateTag`) when the admin publishes. No DB call on most requests.
- Images through `next/image` (or the Cloudinary loader); hero video lazy, muted, with a poster; `prefers-reduced-motion` respected.
- Third-party embeds (reviews, map, VR) load only after consent and on interaction.
- Targets: LCP < 2.5 s on 4G mobile, CLS < 0.05, homepage JS < 150 KB gzip.

## 5. Security

- Admin: Better Auth sessions (httpOnly, Secure, SameSite=Lax), login rate limit, optional TOTP, RBAC checked in every server action and route.
- CSRF: server actions use origin checks; API POSTs verify Origin.
- CSP with nonces; HSTS, frame-ancestors none, Referrer-Policy, Permissions-Policy.
- Uploads: MIME sniffing + allow-list, size caps, direct-to-storage signed uploads for video.
- Secrets: env vars for platform infrastructure; owner-owned provider keys encrypted in the DB (`ENCRYPTION_KEY` env), masked in the UI, write-only.
- Pop-up and CTA links validated (relative paths or an https allow-list); content sanitised.
- Submissions are never logged. Retention job deletes expired submissions (Vercel Cron).
- `npm audit` / Dependabot, gitleaks in CI.

## 6. Environments

| Env | Branch | DB | Email |
|---|---|---|---|
| Local | any | Neon dev branch (or local Postgres) | Resend test mode / log adapter |
| Preview | PR branches | Neon preview branch | Resend, sandbox recipients only |
| Production | `main` (deploy after approval) | Neon main | Resend, verified domain |

## 7. Open architecture decisions

- D6 media provider (see MIGRATION_PLAN).
- Whether editors can schedule publishing (needs Vercel Cron — free tier allows daily jobs; hourly needs Pro).
