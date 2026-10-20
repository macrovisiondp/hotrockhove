# Test Results

Run on 2026-10-20 against the local development build (PGlite database seeded with the migrated content). Production and preview have not been tested yet; there is no deployment.

## Summary

| Gate | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | ✅ no errors |
| Lint | `npx eslint src scripts tests` | ✅ no errors or warnings |
| Unit tests | `npm test` | ✅ 25 / 25 passed |
| End-to-end | `npm run test:e2e` | ✅ 33 / 33 passed (1 sign-in setup + 31 desktop at 1440×900 + 1 mobile on Pixel 7) |
| Production build | `npm run build` | ✅ compiled; all routes dynamic (required for the CSP nonce) |
| Dependency audit | `npm audit --omit=dev` | ⚠️ 4 moderate, one dev-tool chain (see [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) §C) |
| Secret scan | staged diff scanned for API keys, private keys and passwords before each commit | ✅ none found |

## What the tests cover

**Unit (tests/unit):** menu import (all 85 items; "£5:99" kept and flagged, no guessing; Bradon Rost flagged not renamed; bottled-water sizes) · admin price parsing · form validation (required, email, dropdown options, consent, length) · field-definition rules · submission display · link safety (`javascript:`, `//host`, `http:` rejected) · every section type valid · CSV formula-injection protection · UK time zone conversion across daylight saving, including impossible dates · permission matrix · secret encryption round-trip and tamper detection · masking and keep-on-empty · hours grouping · settings validation · redirect matching (exact, trailing slash, case, prefix) · price display fallback · email readiness · HTML escaping in emails · S3 public URL building (bucket, CDN, S3-compatible endpoint, key encoding) and storage settings validation.

**End-to-end (tests/e2e):**
- All 8 public pages render with exactly one `<h1>` and none of the old demo content.
- Desktop: logo centred in the navbar to within 2 px, links balanced either side, nav on one line.
- Mobile: logo centred, no horizontal scroll, menu opens and closes (Escape), quick-action bar, pop-up after 2 s, closes with Escape, doesn't reappear in the same session.
- Menu: 11 categories, "£5:99", "£119.99" and the two bottled-water sizes shown exactly.
- Footer and JSON-LD come from Business settings.
- Book Table falls back to the table-request form.
- Redirects: 301 single hop (including old trailing-slash URLs), 410 for demo pages, 404 for unknown pages.
- Not indexable before launch (meta robots + robots.txt).
- Security headers: CSP nonce, frame-ancestors, X-Frame-Options, nosniff, Referrer-Policy, no X-Powered-By.
- Contact form: server-side validation, then saved and visible in the admin with its email outcome logged.
- Honeypot: bot sees success, nothing stored.
- Table-request form: original fields, consent required, original confirmation text.
- Newsletter: consent required, typed email kept after a validation error, stays "awaiting confirmation"; invalid tokens rejected.
- Admin: login required; wrong password rejected; admin APIs refuse anonymous and forged-cookie requests.
- Business settings change appears on the public site, then is restored; invalid email blocked with a field error.
- Menu price edit appears on the menu page, then is restored.
- API key encrypted, shown only masked, never in the page HTML, removable.
- Draft pages aren't public; staff preview works.
- Viewer role can't open Users, can't export, and sees settings read-only.
- Dashboard readiness list.
- Media storage page shows the S3 setup (bucket policy, CORS); video detail offers a poster picker.

## Bugs found and fixed by testing

| Found | Fix |
|---|---|
| React 19 cleared forms after a server action, so the visitor's email disappeared after a validation error | Submit through `startTransition` (`src/lib/submit.ts`); `action` kept for no-JS |
| Old URLs with a trailing slash took two redirects (308 then 301) | Proxy handles trailing slashes; `skipTrailingSlashRedirect` |
| Impossible dates (2026-13-01) were silently rolled over | `parseLondonLocal` rejects them |
| Pop-up schedule times depended on the server's time zone | Exact Europe/London conversion |
| Story image broke on desktop (`fill` image inside a sticky element) | Separate sticky wrapper |
| Dev-server log inside the project caused an endless reload loop | Log outside the project (documented in SETUP.md) |

## Not yet done

- Automated accessibility scan (axe) and Lighthouse performance runs. These are planned for the Vercel preview, where real hosting and S3 media apply. Manual checks so far: labelled inputs, focus states, keyboard menu and dialog handling, reduced-motion support.
- Real email delivery (needs a Resend account and a verified domain). Locally, emails are logged as "skipped" because delivery is switched off.
- S3 against a real bucket: uploads, presigned video uploads, CORS and public delivery (needs AWS credentials). The storage page's **Test now** checks uploads and public reads.
- Visual check on real iOS/Android devices.
