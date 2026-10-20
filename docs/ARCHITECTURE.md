# Architecture

## 1. Stack (as built)

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.4 (App Router), React 19.3, TypeScript strict | `src/proxy.ts` (Next 16's replacement for middleware) |
| Styling | Tailwind CSS 4 + tokens in `src/app/globals.css` | Public site locked dark (brand); admin light. Sharp corners on the public site |
| Fonts | Cormorant Garamond (display) + Inter (body) via `next/font` | The existing brand fonts, self-hosted |
| Icons | Phosphor | |
| Database | Neon Postgres (production) · PGlite (local) | Same SQL migrations for both |
| ORM | Drizzle ORM + drizzle-kit SQL migrations in `drizzle/` | |
| Auth | Better Auth, email + password, database sessions (12 h), sign-up disabled | Accounts created by the owner or `admin:create` |
| Email | `EmailProvider` adapter: Resend (default) or SMTP (Nodemailer) | `src/lib/email` |
| Media | `StorageAdapter`: **Amazon S3** (production, owner's choice; optional CloudFront), local disk (development only); Cloudinary kept as an alternative adapter | `src/lib/storage` |
| Bot protection | Cloudflare Turnstile (when configured) + honeypot + Postgres-backed rate limits | |
| Validation | Zod 4 everywhere (settings, sections, forms, actions) | |
| Tests | node:test (unit) + Playwright (e2e, desktop + mobile) | |

## 2. Request flow

```
request ─▶ src/proxy.ts
            ├─ /admin/* without session cookie → 307 /admin/login (UX only; every page/action re-checks)
            ├─ redirects table (301/302/410) and trailing-slash 301 → single hop
            ├─ maintenance mode → rewrite to /maintenance (503) unless signed in
            └─ per-request CSP nonce + headers
        ─▶ (site) layout: settings, navigation, Book Table target, pop-ups, consent
        ─▶ page: sections → components (data via cached queries)
```

The proxy reads redirects and the maintenance flag from `/api/internal/routing` (cached 60 s per instance) instead of opening the database itself.

## 3. Rendering and caching

- **Every page renders per request** (`await connection()` in the root layout), because Next.js can only add the CSP nonce during dynamic rendering. Static pages would have unnonced scripts that `strict-dynamic` blocks.
- Database reads go through `unstable_cache` with tags (`pages`, `menu`, `offers`, `media`, `nav`, `popups`, `redirects`, `settings:*`). Admin saves call `revalidateTag(tag, { expire: 0 })`, so changes appear on the next request.
- Images go through `next/image` (AVIF/WebP); S3/CloudFront images are resized and converted on the fly by Next.js, because S3 itself doesn't transform images. Videos need a poster image chosen in Media, since S3 doesn't generate one. Videos are click-to-play (poster only) except an optional muted hero loop that respects reduced motion and Save-Data.

## 4. Data model (`src/db/schema.ts`)

| Table | Purpose |
|---|---|
| `users`, `sessions`, `accounts`, `verifications` | Better Auth; `users.role` ∈ owner/admin/editor/viewer, `users.active` |
| `settings` | One JSON row per group: business, brand, notifications, email, seo, consent, features, storage. Each is validated by Zod; secrets AES-256-GCM encrypted |
| `pages`, `page_revisions` | Slug, status, typed `sections` JSON, SEO fields, review note; last 20 revisions |
| `nav_items` | Header/footer links (`book` = Book Table setting) |
| `redirects` | from, to, 301/302/410, prefix match |
| `menu_categories`, `menu_items` | Prices as `[{label, amountPence}]` + exact `source_price_text` + review note |
| `offers` | Weekly offers with optional dates and promo code |
| `media_assets` | Provider, key, URL, poster, checksum (unique), alt + alt status, rights status + note, source URL |
| `forms`, `form_submissions` | Field definitions JSON, messages, recipients, acknowledgement, retention; submissions with status |
| `newsletter_subscribers` | Status (pending/subscribed/unsubscribed/legacy_unconfirmed), consent text + timestamps, hashed token |
| `popups`, `popup_stats` | Content, targeting, trigger, frequency, schedule; daily aggregate counters |
| `email_log` | Idempotency key (unique), template, status, provider id, error; no message bodies |
| `audit_logs` | Actor, action, entity, metadata (no secrets or submission content), hashed IP |
| `rate_limits` | Fixed-window counters with hashed keys |

## 5. Security controls

- **Authorisation:** `src/lib/rbac.ts` permission matrix. `requirePermission` guards pages; `assertPermission` guards every server action and route handler (tests prove direct calls are refused).
- **Secrets:** owner-only to change; encrypted at rest; masked (last 4) in the UI; never in HTML, logs or audit metadata. Platform secrets (DB, auth, encryption key, Turnstile, cron) are environment variables.
- **Forms:** honeypot → per-IP rate limit → Turnstile → Zod validation → per-email rate limit → save → emails via `after()` with idempotency keys. Bots get a fake success; nothing about internals is revealed.
- **XSS:** no raw HTML is ever rendered from content. Rich text is a minimal parser that outputs React text nodes, JSON-LD escapes `<`, and emails escape every value.
- **Links** from editors are validated: relative paths, https, tel/mailto, or `book`. `javascript:` and `//host` are rejected.
- **CSP:** nonce + `strict-dynamic`, `frame-ancestors 'none'`, `object-src 'none'`; third-party origins documented in `src/lib/csp.ts`. Also HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, and no X-Powered-By.
- **Uploads:** real type detected from file bytes, size limits, dimension check, server-generated keys, de-duplication. Large videos go browser → S3 with a 15-minute presigned PUT for that exact size and type. The server then checks the object (size via HeadObject, real type from its first bytes) and deletes it if it isn't a video.
- **CSV exports** neutralise spreadsheet formulas, are owner/admin only, and are audited.
- **Privacy:** consent banner (essential only by default); reviews widget and analytics load only after "Accept all"; retention cron deletes expired submissions and unconfirmed sign-ups; newsletter needs double opt-in and stores the consent wording.

## 6. Decisions

| Decision | Reason |
|---|---|
| Drizzle over Prisma | Plain SQL migrations to review before deploy; same toolchain as the owner's other projects |
| Nonce CSP with dynamic rendering (not hash-based SRI) | Stronger protection; SRI support is experimental. Cost: no CDN page cache, mitigated by data caching |
| Proxy reads routing data over HTTP | Avoids a second database client inside the proxy (a corruption risk with PGlite in development) |
| Typed sections instead of a free-form page builder | Editors can't break layout or inject HTML; the design stays consistent |
| Business details imported as "unconfirmed" | The old site contradicted itself; launch is blocked until a person confirms |
| Table-request form kept as the Book Table fallback | Preserves the existing workflow until the separate booking system is ready |
| S3 for media (owner decision 2026-10-20) | Owner preference; cheap at this volume; Cloudinary adapter kept, so switching back is a setting |
| Background audio, preloader and 360° tour not rebuilt | Rights and UX issues found in the audit (tour switch exists, off) |
