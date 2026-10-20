# Feature Inventory

Status key: **Active** = verified used by the live site · **Broken** = active but not working · **Dormant** = installed or published but not part of the visitor journey · **Demo** = theme/plugin placeholder.

"Replacement" is a proposal pending owner approval. Nothing is retired without explicit sign-off.

| # | Feature | Purpose | Where today | Depends on | Status | Proposed replacement | How it will be tested |
|---|---|---|---|---|---|---|---|
| F1 | Primary navigation | Site navigation | Header, all pages (separate desktop + mobile menus) | WP menus, UAE header | Active | Admin-managed nav, logo centred, items split left/right | E2E: every nav link 200; visual check at 375/768/1280/1440 |
| F2 | Book Table button | Send visitors to booking | Nav + many CTAs → `booktable.hotrocksteaks.com` | External booking project | Active link; target domain doesn't resolve today | **Configurable URL in Settings** (separate booking project) | Unit: CTA renders setting value; E2E: link `href` matches setting |
| F3 | Menu display | Show dishes and prices | `/our-menus/` (Elementor headings) | Elementor | Active | Structured Menu module (categories, items, prices, notes) | Seed from `menu-snapshot.json`; diff test: every item and price equals the snapshot |
| F4 | Contact form (Gravity Forms #3) | General enquiries | `/contact/` | Gravity Forms, WP Mail SMTP | Active (51 entries); email broken | Forms module: "Contact" | Integration: submit → row stored → admin email + customer acknowledgement sent (Resend test mode) |
| F5 | Contact form (Elementor "New Form") | Duplicate enquiry form | `/contact/` | Elementor Pro | Active (14 unread submissions) | Merge into F4 — **needs approval** | Covered by F4 |
| F6 | Book Table request form (GF #4) | Table requests by email | `/book-table/` (not in nav) | Gravity Forms | Active (10 entries) | Retire in favour of F2 **or** keep as fallback enquiry form — **owner decision** | If kept: same as F4, plus date/time/guest validation |
| F7 | Newsletter subscribe (GF #2) | Email capture | Homepage footer + "opening" pop-up | Gravity Forms | Active (271 entries, 4,052 views) | Newsletter module with explicit consent, double opt-in and unsubscribe | Integration: subscribe → pending → confirm link → subscribed; unsubscribe works |
| F8 | Elementor email-subscribe form | Email capture | Hidden homepage block / Daisy page | Elementor Pro | Dormant or duplicate | Merge into F7 | — |
| F9 | Daisy Fan Club form (GF #1) | Prize draw entry + birthday gift (name, email, phone, birth day and month) | `/daisy/` + "daisypop" pop-up | Gravity Forms | Active (93 entries) | Forms module: "Fan club", with T&Cs link and marketing-consent checkbox | Integration as F4 |
| F10 | Waiting list (GF #5) | Pre-opening list | `/hotrockhove/` | Gravity Forms | Active (2 entries), pre-opening content | Retire (restaurant is open) — **needs approval**; 301 the URL | Redirect test |
| F11 | Pop-up "opening" (#4500) | Promote newsletter | Homepage; 2 s delay, once per session | Elementor Pro Popups | Active | Pop-up module, template "Image + subscribe" | E2E: shows after delay; dismissal sticks for the session |
| F12 | Pop-up "daisypop" (#4662) | Promote fan club | Daisy page; 2 s delay, once per session | Elementor Pro Popups | Active | Pop-up module | As F11 |
| F13 | Pop-up "FDL Subscribe" (#3748) | — | Draft | — | Dormant | Do not migrate | — |
| F14 | Weekly offers + promo codes | Mad Monday / Tenderloin Tuesday / Wagyu Wednesday / Fillet Friday | `/daisy/` | Elementor | Active | "Offers" content model (title, copy, price, code, days, active dates) | Content parity check |
| F15 | Gallery | Food and venue photos and videos | `/gallery/` (50 images, 10 videos) | SimpLy Gallery | Active | Gallery module with lightbox and lazy video | Visual check; every asset loads; keyboard-operable lightbox |
| F16 | Google reviews widget | Social proof ("125 reviews") | Homepage | Trustindex (third-party script) | Active | Option A: keep the Trustindex embed; Option B: Google Places API feed. **Never hand-typed reviews** | Widget loads behind cookie consent |
| F17 | 360° venue tour | Show interior | Homepage hero | `vr.3d66.com` iframe | Active, rights unconfirmed | Optional embed block, lazy-loaded behind a click | Only if owner confirms rights |
| F18 | Background / location audio | Sizzle sounds, cow moo | Site-wide player (ASMR MP3), Daisy, homepage | 3 audio plugins | Active | **Recommend retire** (autoplay audio hurts UX; YouTube-ripped track). Owner decision | — |
| F19 | Map | Directions | Homepage hidden block; Google Maps iframe | WP Go Maps / iframe | Partly hidden | Static map image + "Open in Google Maps" link (no cookies until clicked) | Link opens the correct address |
| F20 | Opening hours, phone, email, address | Business info | Footer + contact | Hard-coded in Elementor | Active, contradictory | Settings module (single source) | Snapshot test of footer from settings |
| F21 | Social links | FB / IG / TikTok | Footer | Elementor | Active | Settings module | Link check |
| F22 | Valentine's campaign | Seasonal promo with countdown | `/valentines/` | Elementor | Out of season | Pages module (draft); reusable campaign page template | — |
| F23 | Wagyu story | Brand story | `/wagyu/` | Elementor | Active | Pages module | Content parity check |
| F24 | WooCommerce shop (Family Feast) | Online sale | `/shop/`, product page | WooCommerce | Dormant ("coming soon", no orders) | **Do not rebuild now**; record as a future option. 301 the URLs | Redirect test |
| F25 | MotoPress appointments | Booking demo | `/reservations/`, `/service/*`, `/employee/*`, `/location/*` | Appointment Booking Lite | Demo | Retire; 301/410 | Redirect/410 test |
| F26 | Comments | — | `/album/sizzling-steak/` | WP comments | Dormant (0 comments) | Retire | — |
| F27 | SEO meta, sitemap, robots | Search | Rank Math | Rank Math | Active | Next.js metadata API + admin SEO fields + `sitemap.xml` + `robots.txt` + Restaurant JSON-LD | Unit and E2E checks on meta tags; sitemap validates |
| F28 | Email delivery | Notifications | WP Mail SMTP (Outlook) | Azure app secret | **Broken** | Resend via an EmailProvider adapter; SMTP adapter as an option | Admin "send test email"; delivery log |
| F29 | Maintenance / coming-soon mode | Hide site | Maintenance + Nifty plugins | — | Installed, not active publicly | Settings flag "Maintenance mode" (admins bypass) | E2E toggle |
| F30 | Preloader | Splash animation | Site-wide | LoftLoader | Active | Retire (hurts LCP); replace with a tasteful hero entrance | Lighthouse LCP |
| F31 | Slider Revolution | Sliders | Scripts load on the homepage | revslider | No visible slider found | Retire | — |
| F32 | Contact Form 7 | — | Two forms defined, none on public pages | CF7 | Dormant | Retire | — |
| F33 | Mailchimp sync | List sync | MC4WP | Not connected | Dormant | Optional newsletter-provider adapter later (Resend Audiences or Mailchimp) | — |
