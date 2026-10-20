# Migration Plan

Principle: the WordPress site stays live and untouched until the new site passes [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md) and the owner approves cutover. All imports are repeatable scripts (`scripts/import/*`) that can be re-run against a fresh database.

## 1. Content

| Source | Method | Target |
|---|---|---|
| Menu (`/our-menus/`) | `docs/data/menu-snapshot.json` (captured) → seed script | `menu_category`, `menu_item`, `menu_item_price` |
| Pages (Home, Wagyu, Daisy, Gallery, Contact, Valentine's) | WP REST `wp/v2/pages` (rendered HTML) + manual mapping into structured sections | `page`, `page_section` (typed blocks) |
| Offers (Daisy) | Manual mapping from the page | `offer` |
| Business info | Owner-confirmed values (see CONTENT_AND_MEDIA_INVENTORY §1) | `site_settings` |
| SEO titles and descriptions | Rank Math values from page HTML `<meta>` | page SEO fields (rewritten only where the value is a placeholder, e.g. contact = phone number) |
| Navigation | WP "Main Menu" | `nav_item` |

Rules: wording is preserved; contradictions are listed for the owner, not resolved silently; demo content is not imported.

## 2. Form submissions (personal data)

Existing entries: Gravity Forms 427 (93 + 271 + 51 + 10 + 2) and Elementor 14.

**Needs owner decision.** Options:
1. **Leave in WordPress** and export to an encrypted CSV archive held by the owner at cutover (recommended for contact, booking and waiting-list entries).
2. **Import subscribers** into the new newsletter table **only** with status `legacy_unconfirmed`, and send a one-time re-permission email. That is a bulk send and needs separate approval. The original sign-up had no explicit consent wording.

Entry contents will not be read, logged or committed during development.

## 3. Media

1. Build the asset list = media-library items used on kept pages ∪ URLs referenced in page HTML but missing from the library (logos etc.).
2. Download by URL (public files only) to a local staging folder outside the repo; record SHA-256, MIME, dimensions and size.
3. De-duplicate by checksum.
4. Exclude rights-unconfirmed assets (ASMR MP3, and others in the inventory) until cleared.
5. Videos: transcode to H.264/AAC MP4 at 1080p and 720p + a poster frame; target < 15 MB per hero clip.
6. Upload to the chosen storage (decision §6) under `hotrock/<year>/<original-filename>`.
7. Write `media_asset` rows (original filename, alt text, caption, checksum, source URL) and rewrite references.
8. Verify: every reference resolves (HTTP 200, correct type), with no hotlinks to `hotrockhove.com/wp-content` left in content.

Alt text: 215 images have none. The import sets an editable placeholder flag and the admin dashboard shows "missing alt text" as a warning. Descriptive alt text will be drafted for review, not published silently.

## 4. URL and redirect map

| Old URL | New URL | Code | Reason |
|---|---|---|---|
| `/` | `/` | — | Kept |
| `/our-menus/` | `/our-menus/` | — | Kept (slug preserved) |
| `/daisy/` | `/daisy/` | — | Kept |
| `/gallery/` | `/gallery/` | — | Kept |
| `/contact/` | `/contact/` | — | Kept |
| `/wagyu/` | `/wagyu/` | — | Kept |
| `/about-us/` | `/about-us/` | — | Kept if the owner supplies copy; otherwise 301 → `/wagyu/` (**decision**) |
| `/valentines/` | `/valentines/` | — | Kept as a draft campaign page; returns 404/302 while unpublished (**decision**) |
| `/book-table/` | Book Table URL setting | 302 | Booking is a separate project (temporary redirect, so it can change) |
| `/reservations/` | Book Table URL setting | 302 | Demo page |
| `/hotrockhove/` | `/` | 301 | Pre-opening waiting list |
| `/shop/`, `/product/family-feast/`, `/cart/`, `/checkout/`, `/my-account/` | `/our-menus/` | 301 | Shop never launched (**decision**: 410 instead?) |
| `/sample-page/`, `/employee/*`, `/location/*`, `/service/*`, `/album/*` | — | 410 | Demo/placeholder content |
| `/wp-admin/*`, `/wp-login.php`, `/feed/`, `/*sitemap*.xml` | `/admin`, `/sitemap.xml` | 301 / 410 | Platform URLs |

Redirects live in the `redirect` table (editable in the admin) and are applied in middleware, with static fallbacks in `next.config`.

## 5. Cutover checklist (each step needs owner approval)

1. Acceptance tests pass on the Vercel preview using production-like data.
2. Owner signs off design, copy, menu and prices.
3. Resend domain verified (DKIM green); test notifications received at the confirmed inbox.
4. Production env vars set; first admin account created; database backup taken.
5. Lower DNS TTL on `hotrockhove.com` to 300 s 24 h ahead (**DNS change — approval**).
6. Point the apex/`www` records at Vercel (**approval**). **MX records stay on Hostinger**, so mail is unaffected.
7. Smoke test production: pages, forms, emails, redirects, sitemap, SSL.
8. Keep WordPress running on a Hostinger temporary domain or subdomain for ≥ 30 days as a rollback. Rollback = restore the previous A/CNAME records.
9. After stability: export the final WP database and uploads as an archive, then the owner decides on decommissioning.

## 6. Decisions needed before build

| # | Decision | Recommendation |
|---|---|---|
| D1 | Correct public phone, email(s), hours and Instagram handle | Owner to confirm |
| D2 | Which inbox receives notifications | Owner to confirm (`info@` or `hello@hotrockhove.com`) |
| D3 | Merge the two contact forms | Yes |
| D4 | Keep the table-request form as a fallback? | No — link to the booking project; keep a general enquiry form |
| D5 | Retire background audio, preloader, VR tour? | Retire audio and preloader; VR tour optional after rights check |
| D6 | Media storage | **Decided by owner (2026-10-20): Amazon S3**, optionally behind CloudFront. Cloudinary adapter kept as an alternative |
| D7 | Legacy subscribers | Archive; re-permission email only with separate approval |
| D8 | About Us copy | Owner to supply, or derive from the founder story |
| D9 | Reviews widget | Keep Trustindex embed (consent-gated) |
| D10 | Shop URLs | 301 to menu |
