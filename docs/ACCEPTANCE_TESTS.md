# Acceptance Tests

Each test has an ID used in progress reports. "Auto" = Playwright/Vitest in CI; "Manual" = checked by a person on the preview URL, with the result recorded here.

## Visual and responsive

| ID | Test | Type |
|---|---|---|
| V1 | At 1280 and 1440 px the logo is horizontally centred in the navbar (±2 px of viewport centre) and nav items are balanced left/right, with 4, 6 and 8 items | Auto (bounding-box) |
| V2 | At 375 and 768 px the logo is centred, the menu button doesn't overlap it, and touch targets are ≥ 44 px | Auto |
| V3 | No horizontal scroll at 320–1920 px on every public page | Auto |
| V4 | Hero, menu, gallery, footer, forms and pop-ups reviewed at 375 / 768 / 1280 / 1440 | Manual (screenshots attached) |
| V5 | Empty, loading, error and success states exist for forms, gallery and admin lists | Manual |
| V6 | `prefers-reduced-motion` disables non-essential motion and video autoplay | Auto |

## Content parity

| ID | Test | Type |
|---|---|---|
| C1 | Every menu item and price on `/our-menus/` equals `docs/data/menu-snapshot.json` (or an owner-approved change list) | Auto |
| C2 | Founder story, Wagyu story, Daisy story and offer copy match the source text | Manual diff |
| C3 | Address, phone, email, hours and socials render from Settings in the header, footer, contact page and JSON-LD consistently | Auto |
| C4 | No demo content (St. Moritz, `+5434567633`, "Grand Restaurant", Sample Page) appears anywhere | Auto (text scan) |

## Functional

| ID | Test | Type |
|---|---|---|
| F1 | Every nav and footer link returns 200 or the intended redirect | Auto |
| F2 | Book Table CTA uses the Settings URL; changing it in the admin updates the site after publish | Auto |
| F3 | Contact form: client and server validation; submission stored; admin notification and acknowledgement sent once (idempotent on double submit) | Auto (email adapter mock) + Manual (real Resend) |
| F4 | Fan-club form: required fields, consent checkbox, stored, notification sent | Auto |
| F5 | Newsletter: subscribe → pending → confirm link → subscribed; unsubscribe link works; general enquiries are never added to the newsletter | Auto |
| F6 | Spam: honeypot filled → rejected silently; > N submissions/min from one IP → 429; missing Turnstile token → rejected | Auto |
| F7 | Pop-up: appears after the configured delay or scroll depth; exit intent on desktop only; one pop-up at a time; dismissal respected per session/persistently; schedule start/end respected; page targeting respected | Auto |
| F8 | Pop-up CTA with `javascript:` or an unlisted external host is rejected on save | Auto |
| F9 | Redirect map: every row in MIGRATION_PLAN §4 returns the stated code and target | Auto |
| F10 | Unknown URL → custom 404 page with status 404 | Auto |
| F11 | Maintenance mode shows the maintenance page to visitors (503) and the normal site to signed-in admins | Auto |

## Admin

| ID | Test | Type |
|---|---|---|
| A1 | `/admin` requires sign-in; failed logins are rate-limited | Auto |
| A2 | Role matrix: viewer can't edit, editor can't change settings/secrets/users, only owner manages users — enforced server-side (direct API calls also refused) | Auto |
| A3 | Page edit → save draft → preview → publish → visible on the site; slug change offers to create a redirect | Auto |
| A4 | Menu: create/edit/reorder/hide item and category; prices stored in pence and displayed correctly | Auto |
| A5 | Media: upload image (jpg/png/webp/avif) and video (mp4) within limits; rejected types refused; alt text editable; replacing an asset keeps references | Auto + Manual (large video) |
| A6 | Email settings: API key saved encrypted, shown masked, never present in any HTML/JSON response; test email reaches the recipient; delivery log records the status | Auto + Manual |
| A7 | Form submissions: search, status, CSV export (admin+ only), delete, retention job removes expired rows | Auto |
| A8 | Audit log records settings, secret, user, publish and delete actions with the actor | Auto |
| A9 | Dashboard shows only real data; when a source isn't configured it says "not configured" | Manual |

## SEO

| ID | Test | Type |
|---|---|---|
| S1 | Each page has a unique title, meta description, canonical, and OG title/image | Auto |
| S2 | `/sitemap.xml` lists only published pages; `/robots.txt` references it; previews are `noindex` | Auto |
| S3 | Restaurant JSON-LD validates (address, phone, hours, menu URL, servesCuisine) using owner-confirmed data only | Auto (schema) + Manual (Rich Results Test) |

## Quality gates (CI)

| ID | Gate |
|---|---|
| Q1 | `tsc --noEmit` clean |
| Q2 | ESLint clean |
| Q3 | `next build` succeeds |
| Q4 | Unit + integration tests pass |
| Q5 | Playwright E2E pass on the preview URL |
| Q6 | axe: no serious/critical violations on public and admin pages |
| Q7 | Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 95, SEO ≥ 95 on Home, Menu, Gallery |
| Q8 | `npm audit --omit=dev` has no high/critical; gitleaks clean |
| Q9 | Link and media checker: no 4xx/5xx, no `hotrockhove.com/wp-content` hotlinks |
| Q10 | Production smoke test after deploy (pages, one form, redirects, sitemap, TLS) |
