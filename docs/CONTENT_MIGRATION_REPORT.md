# Content and Media Migration Report

Status as of 2026-10-20. Source: the live WordPress site, audited on the same day (see [WEBSITE_AUDIT.md](WEBSITE_AUDIT.md)).
Migration is repeatable: `npm run media:import` then `npm run db:seed` (see [SETUP.md](SETUP.md)).

## 1. Record counts

| Content | WordPress (source) | New site | Notes |
|---|---|---|---|
| Menu categories | 11 | 11 | Names kept as written (e.g. "STARTERS", "SPECIAL OPENING OFFER") |
| Menu items | 85 | 85 | Unit test checks every item imports |
| Menu prices kept exactly | 81 clean prices | 81 | £ amounts stored in pence; display identical |
| Menu items flagged for review | — | 5 | See §3. Nothing auto-corrected |
| Weekly offers (Daisy page) | 4 | 4 | Codes MADMONDAY, WAGYU, FILLETFRIDAY; Tenderloin Tuesday has none |
| Public pages | 10 live + 16 demo/shop | 8 published, 2 drafts | Demo pages → 410/301 (§5) |
| Forms | 5 Gravity Forms + 1 Elementor form | 3 forms + newsletter | §4 |
| Pop-ups | 2 active, 1 draft | 2 (same triggers) | Draft "FDL Subscribe" not migrated |
| Media used by migrated pages | 87 files referenced | 85 assets | 2 byte-identical duplicates merged (checksum) |
| Redirects | unknown (Rank Math list not auditable) | 26 | §5 |
| Form submissions (personal data) | ~441 | 0 | Left in WordPress pending the owner's decision |
| Newsletter addresses | 271 | 0 | Owner-only import tool available (legacy, never mailed) |

The full per-file media log is in [data/media-migration-report.json](data/media-migration-report.json).

## 2. Business details (imported, unconfirmed)

Imported from the live footer and contact page into **Admin → Business settings**, all marked **unconfirmed**. Unconfirmed items block launch (dashboard).

| Field | Imported value | Why unconfirmed |
|---|---|---|
| Phone | 01273569060 | Old site also showed 023-94353-012 and demo numbers |
| Email | hello@hotrockhove.com | Forms notified info@hotrockhove.com |
| Address | 141 Church Road, Hove, BN3 2AE | Consistent; still needs a tick |
| Hours | Mon–Fri 4:30pm–10pm, Sat 12pm–10pm, Sun 12pm–9pm (footer) | Two other conflicting sets existed |
| Instagram | instagram.com/hotrock_portsmouth | Portsmouth account |
| Facebook / TikTok | as on the footer | — |
| Notification inbox | *(empty)* | Owner decision (info@ vs hello@) |
| Book Table URL | *(empty)* | Separate booking project; Book Table uses the table-request form meanwhile |

## 3. Data flagged for review (not changed)

| Item | Issue | Where it's shown |
|---|---|---|
| Strawberry (Rocktails) | Price "£5:99" (colon) | Shown exactly as "£5:99" until corrected |
| Bradon Rost | Possibly "Bradan Rost" | Name unchanged |
| Scampi | Described as "breaded lobster tail" | Unchanged |
| Bottled water | "330ml £3.00 , 750ml £4.50" in one string | Split into two labelled prices (same values) |
| Fillet Friday | Listed under "Special opening offer" | Category unchanged |
| Mad Monday offer | Portsmouth wording ("back in Pompey", "no bookings") contradicts "Book Now using code" | Hove wording kept; note in admin |
| Wagyu Wednesday | Tagline "Every wondered…" | Unchanged |
| Daisy fan club | "T + C's Apply" but no terms page exists | Page review note; launch item |

Allergen and dietary information was not published on the old site and **has not been invented**. The menu page says: "Please tell your server about any allergies or dietary requirements before ordering."

## 4. Forms

| Old form | New form | Changes |
|---|---|---|
| Contact (Gravity #3, 51 entries) + Elementor contact (14) | **Contact** | Merged (same three fields). Confirmation text and "We have received your inquiry" acknowledgement kept. The acknowledgement *body* wasn't visible in the audit, so a short neutral body was written; editable under Forms |
| Book Table (Gravity #4, 10) | **Book Table** (`/book-table`) | All fields, options, consent tick and confirmation kept word for word. Used only while no booking-system URL is set |
| Daisy Pop Up Form (Gravity #1, 93) | **Daisy's Fan Club** | Same fields. **Added a required marketing-consent tick box**, because the original collected contact details and birthdays for offers without recording consent. Confirmation: "Thank you for joining Daisy's Fan Club!" (the old form redirected without a message) |
| subscription form (Gravity #2, 271) + Elementor subscribe | **Newsletter** | Now double opt-in with a recorded consent statement and unsubscribe link |
| Waiting list (Gravity #5, 2) | retired | Pre-opening page `/hotrockhove` → 301 to `/` |

## 5. Pages and URLs

| Old URL | New | Status |
|---|---|---|
| `/` | Home (sections below) | Published |
| `/our-menus/` | Our Menu (full structured menu) | Published |
| `/daisy/` | Daisy's Offers (story, offers, fan club form) | Published |
| `/gallery/` | Gallery (47 photos/videos, original order) | Published |
| `/contact/` | Contact | Published |
| `/wagyu/` | Wagyu (full sourcing story) | Published |
| `/book-table/` | Book Table form | Published |
| *(none)* | `/privacy-policy` | **New.** Drafted from the site's actual data practices; needs owner review |
| `/about-us/` | Draft About Us (verified founder text only) | Draft; temporary 302 → `/wagyu` until approved |
| `/valentines/` | Draft seasonal page | Draft; temporary 302 → `/daisy` |
| `/reservations/` | → Book Table | 302 |
| `/hotrockhove/` | → `/` | 301 |
| `/shop/`, `/product/*`, `/cart/`, `/checkout/`, `/my-account/` | → `/our-menus` | 301 |
| `/sample-page/`, `/employee/*`, `/location/*`, `/service/*`, `/album/*`, WordPress system URLs | removed | 410 |
| Any old URL with a trailing slash | same page without the slash | 301 (single hop) |

### Homepage composition

Hero ("It's not just a meal, it's an experience", the original motto) → founder story ("Steak Perfection", full original text, signed Sonny) → "Wagyu journey" video → featured menu items ("Satisfy Your Cravings", the old site's heading) → Google reviews (when the Trustindex widget is configured) → gallery preview ("The Culinary Canvas") → location and hours → newsletter ("Don't Miss the Sizzle").

### Copy edits made (for owner approval)

Original wording was kept wherever it existed. These small editorial changes were made and can be reverted in the admin:

- Removed two "😊" emojis from the homepage Wagyu video caption and combined the caption headings into sentences. The Wagyu page keeps its emojis exactly.
- Old "OUR NEW LOCATION" heading → "Our location" ("new" is out of date).
- "Learn More" under the founder story pointed to the theme-demo About page; it now goes to `/wagyu`.
- Fan club intro recased: "For a chance to win £200 towards your future Hot Rock experiences. (T + C's Apply)".
- Duplicated paragraphs on the old Wagyu page (desktop and mobile copies) appear once.
- New interface text that didn't exist before (form labels such as "(optional)", the cookie banner, 404 page, allergy note, privacy policy) is plain functional wording, not business claims.

Not migrated: theme demo copy (About Us "Grand Restaurant", "wood-fired grill"), placeholder testimonials, the St. Moritz address and demo phone numbers, the pre-opening "Opening 29th January" blocks.

## 6. Media

- **85 assets** imported with original file names, dimensions, SHA-256 checksums and source URLs. Duplicates were merged by checksum.
- **Alt text:** written by viewing every image: 68 reviewed, 5 marked "needs review" (they identify Sonny, or the subject is inferred), and the 12 videos have no description yet. These counts are from the admin dashboard.
- **Rights:** 9 files are marked *unconfirmed*: 8 stock photos from the WordPress theme demo (Envato filenames, not used on any page) and the "Steak-Sizzling.mp4" clip of unknown origin. The random-named WebP food photos show Hot Rock branding and are marked cleared with a note to confirm.
- **Excluded entirely:** the YouTube-ripped "ASMR … Applebees Grill Bar" audio (3 copies) and the cow "moo" sound (background audio is retired).
- **Too large for Cloudinary's free plan (100 MB per video):** `WhatsApp-Video-2026-02-04-at-3.05.26-PM.mp4` (105.9 MB). It's imported in local development; for production, compress it (e.g. HandBrake 1080p H.264) and upload through Admin → Media.
- **360° tour (vr.3d66.com):** not embedded. The feature switch stays off until ownership is confirmed.

### Still to do for production media

1. Configure Cloudinary in Admin → Media → Storage settings.
2. Run `npm run media:import` against the production database. It uploads to Cloudinary and records the new URLs.
3. Re-run `npm run db:seed -- --force=pages,offers,popups,menu` **only on a fresh database** (it replaces page content), or reassign images in the admin.
