# Content and Media Inventory

Captured 2026-10-20 from the live site. Machine-readable data:

- [data/menu-snapshot.json](data/menu-snapshot.json) — every menu item, description and price **exactly as published** (85 items, 11 categories).
- [data/media-inventory.json](data/media-inventory.json) — all 239 public media-library items, with dimensions, size, alt text and the pages that use each one.

## 1. Business information (as published — conflicts flagged)

| Field | Value(s) found | Where | Conflict? |
|---|---|---|---|
| Name | Hot Rock Hove / Hot Rock Steakhouse / Hot Rock Steaks | Footer, forms, email "from" names | Confirm the public trading name |
| Address | 141 Church Road, BN3 2AE, Hove | Footer, contact, map | — |
| Phone | 01273569060 | Footer, contact | Also `023-94353-012` (contact meta + heading), `+5434567633` and `(343)454-4364` (demo) |
| Public email | hello@hotrockhove.com | Footer, contact | Forms notify `info@hotrockhove.com`; waiting-list page shows `info@hotrocksteaks.com` |
| Hours (footer) | Mon–Fri 4:30pm–10pm · Sat 12pm–10pm · Sun 12pm–9pm | Footer, contact | Hidden hero A: Mon–Fri 4:30–10:30, Sat 12–11, Sun 12–10:30. Hidden hero B: Mon–Thu 4:30–10, Fri 4:30–10:30, Sat 3–10:30, Sun 3–9:30 |
| Socials | facebook.com/share/1CC74r87Kn · instagram.com/hotrock_portsmouth · tiktok.com/@hot.rock.steakhouse | Footer | Instagram handle is Portsmouth |
| Founder | "Sonny (The Steak Sheikh), Executive Chef & Hot Rock Founder" | Homepage | — |

**Owner action:** confirm the correct value in each row before launch. The new site will hold one source of truth in Settings.

## 2. Copy to preserve (original wording)

| Page | Keep | Notes |
|---|---|---|
| Home | Founder welcome ("Welcome to Hot Rock, the home of the finest hand-selected…", signed Sonny); tagline "It's not just a meal, it's an experience"; "Wagyu journey" captions; "The UK's premier Wagyu steakhouse, serving exclusive Wagyu cuts." | "Opening 29th January 2026 / opening soon" blocks are stale |
| Wagyu | Full sourcing story (Japan → Casino, NSW; A5+9 Full Blood Wagyu) | Paragraphs are duplicated on the live page (desktop/mobile copies) — keep one |
| Daisy | Mascot story; four weekly offers with codes `MADMONDAY`, `WAGYU`, `FILLETFRIDAY`; Tenderloin Tuesday (no code); fan-club prize copy "chance to win £200 … (T + C's Apply)" | "Hot Rock is back in Pompey!" refers to Portsmouth. The T&Cs referenced don't exist on the site |
| Menu | All 85 items verbatim | See §3 |
| Valentine's | Campaign copy | Seasonal; migrate as a draft |
| Waiting list | Landing copy | Pre-opening; archive only |
| About Us | — | **Theme demo copy** ("Grand Restaurant promises…", "wood-fired grill", a generic testimonial). Not the restaurant's voice; contradicts lava-rock cooking. Recommend the owner supplies a real About page, or it's built from the Home and Wagyu story |

Not migrated without approval: Sample Page, MotoPress demo pages, Reservations demo, theme placeholder testimonials ("The service was also excellent…").

## 3. Menu (summary)

| Category | Items | Category note |
|---|---|---|
| Starters | 14 | — |
| Premium Range | 2 | All served with steak chips… |
| Mains | 11 | All served with steak chips… |
| Special Opening Offer | 1 (Fillet Friday £29.99) | Stale "opening" label? |
| Burgers | 4 | Brioche bun note |
| Sides & Extras | 19 | — |
| Desserts | 4 | — |
| Drinks | 11 | — |
| Rocktails | 6 | "Our own house made mocktails" |
| Beers, Wines and Ciders | 9 | "All drinks are Alcohol free." |
| Hot Drinks | 4 | — |

Data issues to confirm (not silently fixed):
- "Strawberry" Rocktail is priced `£5:99` (colon).
- "Bradon Rost" — probably "Bradan Rost" (Scottish hot-smoked salmon).
- "Bottled water" has two prices in one string (330ml £3.00, 750ml £4.50) → will be modelled as two price variants.
- "Scampi" is described as "breaded lobster tail".
- Allergen and dietary information is **not published** anywhere. None will be invented.
- The menu page also has "Online / Main Courses / Cocktails" tab headings with no content.

## 4. Media

| Metric | Value |
|---|---|
| Media items (public REST) | 239 (admin count shows 256; the difference is private or unattached items) |
| Types | 116 JPEG · 94 WebP · 5 PNG · 19 MP4 · 4 MP3 · 1 TXT |
| Total original size | ≈ 421 MB |
| Used on current public pages | 93 items (≈ 236 MB); on primary pages 91 items (≈ 207 MB, of which 11 videos ≈ 156 MB) |
| Unused in the library | 146 items |
| Images without alt text | 215 of 232 |
| Referenced on pages but missing from the public library | Logos `2023/10/HR.png`, `HR-W.png`, `2026/01/hrlo.png`; `2026/01/shared-image-1.jpg`, `2026/01/Instagram-post-132.jpg.jpeg`, `2026/02/lsca.png`, `2026/02/val.jpg` — fetch these by URL |

### Live media by page

| Page | Images | Videos | Audio | MB |
|---|---|---|---|---|
| `/gallery` | 39 | 10 | 1 | 190.3 |
| `/` | 18 | 1 | 2 | 38.2 |
| `/our-menus` | 14 | 0 | 1 | 35.6 |
| `/daisy` | 14 | 0 | 2 | 32.5 |
| `/valentines` | 6 | 0 | 1 | 29.8 |
| `/about-us` | 7 | 0 | 1 | 29.7 |
| `/wagyu` | 5 | 0 | 1 | 29.5 |
| `/hotrockhove` | 2 | 0 | 1 | 29.1 |
| `/contact` | 2 | 0 | 1 | 29.0 |
| `/book-table` | 2 | 0 | 1 | 28.9 |

About 28.8 MB on almost every page is the site-wide ASMR MP3 player.

### Largest videos (need transcoding before migration)

| File | Size | Resolution |
|---|---|---|
| `2026/02/WhatsApp-Video-2026-02-04-at-3.05.26-PM.mp4` (gallery) | 105.9 MB | 1920×1080 |
| `2025/10/1014-1.mp4` | 51.0 MB | 1920×1080 |
| `2025/12/Steak-Sizzling.mp4` (homepage) | 50.5 MB | 1920×1080 |
| `2026/02/sun.mp4` (gallery) | 15.3 MB | 960×544 |
| Remaining WhatsApp clips | 1–7.5 MB each | mostly 478×850 portrait |

Several files are duplicates (`…11.34.34-AM-1.mp4`, `-1-1`, `-1-2`, `-1-3`; 3 copies of the ASMR MP3; `7CJZ46…` vs `7CJZ46…-1`). De-duplicate by checksum during migration.

### Rights to confirm before migration

- `ASMR-One-Hour-of-Soothing-Grill-Sounds-–-Sizzling-Meat-Applebees-Grill-Bar-youtube-*.mp3`: appears ripped from YouTube. **Exclude** unless a licence is shown.
- `cow-mooing-343423.mp3`: filename matches the Pixabay pattern. Confirm the licence.
- `vr.3d66.com` 360° tour: confirm ownership and embed permission.
- 2026/01 square WebP images with random names (`7CJZ46OQ5NM36ASMTD4NFGHH.webp` etc.): source unknown; possibly AI-generated or stock. Confirm.
