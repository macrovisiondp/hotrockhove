# Integrations and Emails

## 1. Current email set-up (as found)

| Item | Value |
|---|---|
| Sending plugin | WP Mail SMTP Pro |
| Mailer | Outlook (Microsoft 365 via an Azure app registration) |
| From | `admin@hotrocksteaks.com`, name "Hot Rock Steaks", force-from on |
| Status | **Failing.** Plugin notice: last send unsuccessful, `invalid_client: AADSTS7000222` (Azure client secret expired) |
| Domain of sender | `hotrocksteaks.com`: NXDOMAIN on public DNS (2026-10-20) |
| Inbound mail for hotrockhove.com | Hostinger (`mx1/mx2.hostinger.com`) |
| SPF (hotrockhove.com) | `v=spf1 include:_spf.mail.hostinger.com ~all` |
| DMARC (hotrockhove.com) | `v=DMARC1; p=none` (no reporting address) |
| DKIM | Not checked (selector unknown, no hPanel access) |

No secrets were viewed or copied.

## 2. Form notifications (Gravity Forms)

| Form | ID | Entries / views | Admin notification | Customer email | On-screen confirmation |
|---|---|---|---|---|---|
| Daisy Pop Up Form | 1 | 93 / 344 | To `info@hotrockhove.com` — "New Daisy Pop Up Form Submission: {Full Name}", from-name "Hot Rock Steaks Daisy Pop Up Form" | None | Redirects to page "Daisy" |
| subscription form | 2 | 271 / 4,052 | To `info@hotrockhove.com` — "New Subscribe Form Submission" | None | Redirects to Home |
| Contact | 3 | 51 / 350 | To `info@hotrockhove.com` — "New Contact Form Submission: {Name}" | "We have received your inquiry" (to the email field) | "Thank you for contacting us! We will get in touch with you shortly." |
| Book Table | 4 | 10 / 65 | To `info@hotrockhove.com` — "New submission from {form_title}" | None | "Thanks for choosing Hot Rock Steaks. Your table request has been successfully submitted. A member of our team will reach out shortly to confirm your reservation…" |
| Waiting List | 5 | 2 / 42 | To `{admin_email}` | "Welcome to Our Waiting List! 🎉" | "🎉 Thank you! You're on the list. We'll contact you…" |

All notifications send from `{admin_email}`, which WP Mail SMTP overrides to `admin@hotrocksteaks.com`.

### Form fields (verified from the form previews)

- **#1 Daisy fan club:** Full Name*, Email*, Phone*, note "Just to send gift on your birthday", Birth Day* (1–31), Birth Month* (Jan–Dec). No consent checkbox, and the T&Cs it mentions don't exist on the site.
- **#2 Subscribe:** Email*. No consent wording or unsubscribe process.
- **#3 Contact:** Name, Email*, Message* (help text "Please let us know what's on your mind…").
- **#4 Book Table:** Full Name*, Phone*, Email*, Reservation Date*, Time* (HH:MM AM/PM), Guests* (1–6+), Occasion (Birthday / Anniversary / Date Night / Business Meeting / Family Dinner / Other), Special Requests, consent* "I agree to be contacted regarding my reservation."
- **#5 Waiting list:** Full Name*, Email*, Phone*, with the text "By joining, you agree to receive updates… unsubscribe anytime."
- **Elementor contact form** (Contact page): Name, Email, Message — 14 unread submissions in Elementor.

## 3. Other integrations

| Integration | Use | Credentials / account needed | Plan |
|---|---|---|---|
| Booking system (`booktable.hotrocksteaks.com`) | Book Table CTA | — | **Separate project.** Configurable URL in Settings |
| Trustindex — Google reviews | Homepage widget | Trustindex account (owner) | Keep the embed (loaded after consent) or switch to the Google Places API |
| Google Maps | Iframe + WP Go Maps | None for a link; API key for an embed | Use a link or static map; no API key needed |
| 3d66 VR tour | Homepage iframe | — | Optional, pending rights confirmation |
| Facebook / Instagram / TikTok | Footer links | — | Settings |
| Mailchimp (MC4WP) | Not connected | — | Not needed now |
| WooCommerce | Shop "coming soon", 1 product, no orders | — | Not rebuilt |
| Analytics | None found | — | Optional: GA4 or Plausible, loaded only after consent |
| Spam protection | Gravity Forms honeypot; reCAPTCHA script seen on the homepage | — | Cloudflare Turnstile + honeypot + rate limiting |

## 4. New email design

- **Provider:** Resend (default) behind an `EmailProvider` interface; `SmtpProvider` (Nodemailer) as an alternative adapter.
- **Sending domain:** `hotrockhove.com`. Suggested sender `Hot Rock Hove <no-reply@hotrockhove.com>`, reply-to the confirmed public inbox.
- **DNS needed (owner approval required — DNS change):**
  - Resend DKIM: `resend._domainkey.hotrockhove.com` TXT (value issued by Resend).
  - Resend return-path on a subdomain (e.g. `send.hotrockhove.com` MX + SPF TXT, as issued by Resend), so Hostinger's root SPF stays unchanged.
  - DMARC: keep `p=none`, add `rua=` reporting, then move to `quarantine` after 2–4 clean weeks.
- **Credentials:** the Resend API key belongs to the owner's account. Stored encrypted (AES-256-GCM, key from an env var) in the database, editable in Admin → Email, never returned to the browser (masked), with an env-var fallback. Database, auth secret, encryption key and Turnstile stay as Vercel env vars.
- **Yahoo / other SMTP:** Yahoo requires an app password for SMTP, and `yahoo.com` publishes DMARC `p=reject`, so mail must be *from* the Yahoo address itself and is subject to Yahoo's sending limits. This is fine for low-volume admin notifications, not for customer-facing mail. To be re-verified when the adapter is built.
- **Safeguards:** send only after validation and persistence succeed; one idempotency key per submission + template; delivery log (status, provider id, error summary — no message bodies); retry with backoff; admin test-send button.

### Workflows to implement

| Workflow | Trigger | Recipient |
|---|---|---|
| Contact — admin notification | Contact form | Configured inbox |
| Contact — acknowledgement | Contact form | Submitter |
| Fan club — admin notification (+ optional acknowledgement) | Fan-club form | Inbox / submitter |
| Newsletter — confirm subscription (double opt-in) | Subscribe form / pop-up | Submitter |
| Newsletter — unsubscribe confirmation | Unsubscribe link | Submitter |
| Table request — admin + acknowledgement | Only if F6 is kept | Inbox / submitter |
| Admin password reset / sign-in security | Admin auth | Admin user |
| Delivery-failure alert | N consecutive provider errors | Configured admin |

Bulk marketing sends are **out of scope** and will not be built or sent without separate approval.
