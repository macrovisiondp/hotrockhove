# Implementation Plan and Status

Status key: ✅ done and tested · 🟡 built, needs external setup or owner review · ⏳ not started

| Stage | Item | Status |
|---|---|---|
| A. Audit | Audit reviewed; plan, dependencies and external-access gaps recorded | ✅ ([LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) §B) |
| B. Foundation | Next.js 16 + TypeScript strict + Tailwind 4; design tokens; Drizzle schema and migration; Better Auth; RBAC; settings with encrypted secrets; CSP, security headers, rate limits, audit log | ✅ |
| C. Public site | Centred-logo navigation, mobile menu and quick-action bar, section-based pages, full menu, offers, gallery with lightbox, forms, newsletter (double opt-in), cookie consent, pop-ups, SEO metadata, JSON-LD, sitemap/robots, redirects/410, 404, maintenance | ✅ |
| D. Admin | Dashboard + launch readiness; Business settings; pages (section editor, preview, revisions, publish); menu; offers; media (upload, replace, alt text, rights, usage check, Cloudinary direct video upload); navigation; pop-ups; forms (field editor, notifications, retention); submissions (search, status, CSV, delete); newsletter (consent records, export, legacy import); email (Resend/SMTP, masked keys, test, log); SEO and redirects; site settings; users; activity log; my account | ✅ |
| E. Migration | Menu (85 items, verbatim), offers, page copy, forms, pop-ups, redirects, 85 media assets with alt text and rights; business details imported as unconfirmed | ✅ locally · 🟡 production run pending (Neon + Cloudinary) |
| F. Testing | 23 unit tests; 32 Playwright end-to-end tests (desktop + mobile, incl. sign-in setup); type check; lint; production build | ✅ ([TEST_RESULTS.md](TEST_RESULTS.md)) |
| G. Preview | Vercel project, Neon, env vars, preview deployment | ⏳ needs accounts ([DEPLOYMENT.md](DEPLOYMENT.md)) |
| H. Launch | DNS cutover, production smoke tests, monitoring | ⏳ needs owner approval |
