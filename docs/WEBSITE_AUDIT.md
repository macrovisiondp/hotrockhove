# Website Audit — hotrockhove.com

Audit date: 2026-10-20
Method: public crawl of every URL in the Rank Math sitemaps (26 URLs, all HTTP 200), DNS lookups, and a read-only review of the logged-in WordPress admin (user `Dezanidesign`). Nothing in WordPress was changed.

Raw supporting data: [data/media-inventory.json](data/media-inventory.json), [data/menu-snapshot.json](data/menu-snapshot.json).

## 1. Platform

| Item | Finding |
|---|---|
| CMS | WordPress 7.1.3, PHP 8.3, LiteSpeed |
| Host | Hostinger (hPanel). DNS on Hostinger (`ns1/ns2.dns-parking.com`) |
| Theme | Grand Restaurant (ThemeGoods, Envato) + Elementor 4.3.5 / Elementor Pro 4.3.1 (update pending) |
| Page builder | Elementor for all content pages; header/footer via "Ultimate Addons for Elementor" (header-footer-elementor) |
| Caching | Breeze |
| SEO | Rank Math (sitemaps, meta, robots). Redirections screen returned HTTP 403 — module likely disabled, see limitations |
| Mail | WP Mail SMTP Pro using the **Outlook** mailer, from `admin@hotrocksteaks.com` — **currently failing** (see §4) |
| Mail DNS | MX → Hostinger. SPF `include:_spf.mail.hostinger.com ~all`. DMARC `p=none`. No DKIM selector checked yet |
| Users | 4 users, all Administrators |
| Analytics | No Google Analytics / GTM / Meta pixel tag found in the public HTML |
| Cookie consent | **None** found |
| Legal pages | Privacy Policy and Refund & Returns Policy exist **only as drafts** — no live legal pages |

### Plugins (active unless noted)

Advanced Product Fields for WooCommerce · Appointment Booking Lite (MotoPress) · Background Music for Elementor · Background Music Manager · Breeze · Contact Form 7 · Custom Fonts · Duplicate Page · Elementor · Elementor Google Map Extended · Elementor Pro · Envato Market · Grand Restaurant Theme Custom Post Type · Grand Restaurant Theme Elements · Gravity Forms 2.9.26 · HTML5 Audio Player · LoftLoader · Maintenance · MC4WP (Mailchimp) · MP3 Audio Player by Sonaar · Nifty Coming Soon & Maintenance · One Click Demo Import · Rank Math SEO · SimpLy Gallery Block · Slider Revolution · Ultimate Addons for Elementor · Widgets for Google Reviews (Trustindex) · WooCommerce · WP Go Maps · WP Mail SMTP Pro · WP Maps · one active plugin with no name shown in the list.
Inactive: Akismet, Hello Dolly, Object Cache Pro, Post SMTP, WP Reset PRO.

Installed ≠ used. Which plugins actually drive live behaviour is recorded in [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md).

## 2. Public pages

| URL | Status in practice | Notes |
|---|---|---|
| `/` | Live, main page | Visible: "See what's coming" + embedded 360° tour (`vr.3d66.com`), founder story, Google reviews widget, Wagyu journey + video, gallery teaser, location audio, footer. Several "Opening 29th January 2026 / opening soon" hero blocks exist but are hidden on all breakpoints |
| `/our-menus/` | Live, in nav | Full menu, 85 items / 11 categories, prices in GBP |
| `/daisy/` | Live, in nav ("Daisy's Offers") | Mascot story, weekly offers with promo codes, Daisy fan-club form + pop-up |
| `/gallery/` | Live, in nav | ~50 images + 10 videos (SimpLy Gallery) |
| `/contact/` | Live, in nav | Two contact forms on one page (Gravity Forms + Elementor). Meta description is a stray phone number `023-94353-012` |
| `/wagyu/` | Live, in nav | Founder's Wagyu sourcing story |
| `/about-us/` | Live, **not in nav** | Mostly theme demo copy ("Grand Restaurant promises…", "wood-fired grill") that contradicts the lava-rock concept |
| `/hotrockhove/` | Live, not in nav | Pre-opening waiting-list landing page. Shows `info@hotrocksteaks.com` |
| `/valentines/` | Live, not in nav | Valentine's campaign with countdown (season over) |
| `/book-table/` | Live, not in nav | Gravity Forms table-request form (10 entries) |
| `/reservations/` | Live, not in nav | MotoPress booking demo with demo address "Via Serlas 546, St. Moritz, Switzerland" and phone `(343)454-4364` |
| `/shop/`, `/product/family-feast/`, `/cart/`, `/checkout/`, `/my-account/` | WooCommerce in "coming soon" mode ("Great things are on the horizon") | One product: Family Feast £100 (sale £99.90). No orders found |
| `/sample-page/` | Live | WordPress default page |
| `/album/`, `/album/sizzling-steak/` | Live | Sonaar audio playlist + open comment form |
| `/employee/…`, `/location/restaurant-branch-1/`, `/service/*` (5) | Live | MotoPress demo content, indexable |

Main nav (desktop and mobile menus are separate WP menus with the same items): Home · Our Menu · Daisy's Offers · Gallery · Contact · Wagyu · Book Table.
"Book Table" points to `https://booktable.hotrocksteaks.com/`. **Per the owner, booking is a separate project; the new site will keep a configurable Book Table URL.** (Today that domain does not resolve.)

Footer: Facebook / Instagram / TikTok · Overview links · `hello@hotrockhove.com` · `01273569060` · 141 Church Road, BN3 2AE, Hove · opening hours · © 2026 Hot Rock Hove.

## 3. Visual identity (as built)

- Black (`#000`) surfaces, white and grey (`#B9B9B9`) text, bronze accent `#BA9774`, occasional red `#C02B0A`.
- Display type: **Cormorant Garamond**; body: **Inter**.
- Logo: white "HOT ROCK · STEAKHOUSE" lockup with flame (`/wp-content/uploads/2023/10/HR.png`, `HR-W.png`, `2026/01/hrlo.png`). Currently centred *below* the nav, not inside it.
- Preloader (LoftLoader), background audio players and a 360° iframe add significant page weight: the homepage HTML alone is 436 KB, and the admin browser tab became unresponsive during the audit.

## 4. Critical issues found

| # | Issue | Impact |
|---|---|---|
| C1 | **Outgoing email is failing.** WP Mail SMTP shows: last send failed, Outlook mailer, `AADSTS7000222` (expired Azure client secret). From address is `admin@hotrocksteaks.com`; `hotrocksteaks.com` returns NXDOMAIN | Admin notifications and customer acknowledgements from all forms are very likely not being delivered. Submissions are still stored in WordPress |
| C2 | **No live privacy policy or cookie consent**, while collecting names, emails, phones and birthdays | UK GDPR / PECR exposure |
| C3 | Notification recipient is `info@hotrockhove.com`, but the public address is `hello@hotrockhove.com`; the waiting-list page shows `info@hotrocksteaks.com` | Needs owner confirmation of the correct inbox(es) |
| C4 | Conflicting opening hours (footer vs. hidden hero blocks) and stale "opening 29th January 2026" content | Owner must confirm current hours |
| C5 | Demo/placeholder content is public and indexable (St. Moritz address, `+5434567633`, `(343)454-4364`, Sample Page, MotoPress demo pages, theme demo copy on About Us) | SEO and trust damage |
| C6 | Instagram link is `hotrock_portsmouth`; Daisy page says "Hot Rock is back in Pompey!" | Confirm whether Hove has its own Instagram, and which offers apply to Hove |
| C7 | Third-party media with likely rights problems: a 1-hour "ASMR … Applebees Grill Bar youtube" MP3 (28.8 MB, 3 copies) | Do not migrate without confirmation |
| C8 | Homepage hero embeds a third-party 360° tour from `vr.3d66.com` (Chinese 3D platform, labelled "RonGroup", "牛扒店") | Confirm it is Hot Rock's commissioned render and that it may be embedded |
| C9 | 215 of 232 images have no alt text | Accessibility and SEO |
| C10 | Mailchimp (MC4WP) installed but **not connected**; newsletter sign-ups only sit in Gravity Forms entries | 271 subscriber emails exist only inside WordPress |

## 5. What could not be audited (needs access or a decision)

- **Rank Math redirections** (HTTP 403) and 404 monitor — need a check from an admin with Rank Math permissions, or confirmation the module is off.
- **Form entry contents** — deliberately not read or exported (private data). Export and lawful basis needs owner approval (see MIGRATION_PLAN).
- **Elementor pop-up display conditions** — triggers were read from the live HTML (2 s delay, once per session); page targeting inferred from where they render.
- **Hostinger hPanel**: backups, mailboxes on `hotrockhove.com`, DKIM — no access.
- **Azure / Microsoft 365 tenant** behind the Outlook mailer and the `hotrocksteaks.com` domain status — no access.
- **Google Business Profile / Trustindex account** — reviews widget shows "125 reviews, Excellent"; account access is needed to keep a live feed.
- **Social accounts** — only the links were checked.
- Trustindex, Breeze, Slider Revolution and LoftLoader settings were not opened individually; they don't hold business data.
