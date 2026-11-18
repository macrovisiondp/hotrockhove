# Enquiry Management

How website enquiries reach the Hot Rock team, where they're kept, and how to make sure none are lost. Checked against the live site on 18 November 2026.

## 1. Where each enquiry goes

| Form | Where it is on the site | Staff email goes to | Customer gets a confirmation | Kept for |
|---|---|---|---|---|
| Book Table (table requests) | /book-table, every "Book Now" / "Book Table" button | hello@hotrockhove.com | Yes | 6 months |
| Birthday enquiry | /birthdays ("Enquire Now") | hello@hotrockhove.com | Yes | 12 months |
| Christmas enquiry (incl. group bookings, parties, gift vouchers) | /christmas ("Enquire Now") | hello@hotrockhove.com | Yes | 12 months |
| Contact | /contact, /franchise ("Register your interest") | hello@hotrockhove.com | Yes | 12 months |
| Daisy's Fan Club | /daisy and its pop-up | hello@hotrockhove.com | Yes | 2 years |
| Newsletter sign-up | Footer / newsletter blocks | No staff email (sign-ups listed under Newsletter) | Yes: a confirm-your-subscription email | Until they unsubscribe |

- **Who receives staff emails** is set in **Admin → Email & notifications → Notification recipients**. Any number of addresses can be added (up to 25), and each one chooses **All notifications** or particular forms. For example, an events address could receive only Birthday and Christmas enquiries. hello@hotrockhove.com receives everything.
- **Staff emails** come from no-reply@hotrockhove.com (sent by Resend). They contain every answer and an **Open in admin** button, and **pressing Reply answers the customer directly**.
- **Customer confirmations** use the Hot Rock email design (logo header) and include a copy of what the customer sent. If the customer replies, it goes to hello@hotrockhove.com (or the Reply-to address set under Email & notifications).

## 2. Where submissions are stored

- **Every submission is saved to the website database *before* any email is sent.** A missed, delayed or bounced email never loses the enquiry.
- **Database:** Neon Postgres (project *hotrockhove*, AWS us-east-2), table `form_submissions`. Each record holds every answer exactly as submitted, the form it came from, a status, and a one-way hash of the sender's IP address for spam control. It does not hold the IP address itself.
- **Email log:** every email the site tries to send is recorded under **Admin → Email & notifications → Email log**, as *sent*, *failed* or *skipped*, with the reason.
- **Automatic deletion:** records are deleted after the retention period shown above (a daily job). Change a form's period under **Forms → the form → Data retention**.
- **Backups:** Neon keeps point-in-time history of the database. A full export was also taken before this round of changes, on 18 Nov 2026 at 14:49 UTC. It's stored only on the developer's machine, in the git-ignored `.data/backups` folder.

## 3. How the back-office team accesses and manages enquiries

Sign in at **hotrockhove.com/admin**.

- **Dashboard:** shows a count of **New submissions** and the most recent ones.
- **Form submissions:** lists every enquiry.
  - **Filter and search:** by form (e.g. only Birthday enquiries) or by status (*new*, *read*, *archived*, *spam*), or search any text such as a surname, phone number or date.
  - **Open one** to see every answer, with a **Reply by email** button. Opening an enquiry marks it *read*. Use **Archive** once it's dealt with, so *new* and *read* together show what still needs attention.
  - **Export** downloads a CSV for spreadsheets (owner/admin).
  - **Delete** is for erasure requests only (owner/admin). Every deletion is recorded in the Activity log.

**Who can see what:**

| Role | Read, archive, mark spam | Delete / export | Change recipients and forms |
|---|---|---|---|
| Owner | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes |
| Editor | Yes | No | No |
| Viewer | No | No | No |

## 4. If a notification email is missed

**Every enquiry can still be retrieved.** It stays under **Form submissions** until its retention period ends, whether or not the email arrived. The Email log shows whether the notification was sent and, if not, why.

Recommended routine: **check Form submissions once a day** (filter Status = *new*) and archive what's been handled. This is especially important for Birthday, Christmas and group-booking enquiries.

## 5. What was tested

| Check | Result |
|---|---|
| Submissions saved before email; a failed email can't lose an enquiry | Confirmed in code and by test |
| Staff emails go to the right recipients per form (e.g. Birthday → hello@ + events address; Contact → hello@ only) | Passed (test database) |
| Every form sends the customer a confirmation, with replies routed to hello@ | Passed (test database) |
| Live pipeline on the production site | Passed: Fan Club enquiry on 18 Nov 01:56. Staff email **sent**, customer confirmation **sent** |
| Field validation (required fields, email, phone, dates, number of guests 1–1000, consent) | Passed (automated tests) |
| Birthday, Christmas, Merchandise and Franchise pages on mobile (375px), tablet (768px) and desktop | Passed: no horizontal scrolling, form fields fit the screen |
| Page titles and SEO descriptions on the new pages | Present on all four |
| "Book Now" → Book Table page; "Enquire Now" → the page's form; "Ask about this" → Contact | Correct |
| Spam protection: hidden trap field, rate limits, Cloudflare Turnstile (on since 17 Nov) | Active |

**Not yet tested on the live site:** a real Birthday, Christmas, Contact and Book Table submission. Cloudflare Turnstile (the spam check) rightly stops automated submissions, so a person needs to do this once (section 7).

## 6. Issues found and what was done

| Issue | Status |
|---|---|
| Email sending and the hello@ recipient were only switched on on **17 Nov**. The 8 enquiries received 1–16 Nov (2 table requests, 3 contact, 3 fan club) never triggered a staff email | **Action needed:** review them under Form submissions (Status = *new*) |
| 19 contact submissions from 21–22 Oct are not in the database | Investigated: each was deleted by the owner account a minute or so after arriving, which matches testing during setup. All 19 deletions are recorded in the Activity log; none disappeared unexplained |
| Book Table and Fan Club sent no confirmation to customers | Fixed: every form now confirms |
| Customer replies went to no-reply@ and were lost | Fixed: replies go to hello@ (or the Reply-to address) |
| A form's own recipients *replaced* the main list (risk of nobody being told) | Fixed: they're now added to it |
| Privacy policy didn't cover birthday/Christmas enquiries, confirmation emails, allergy information or Twilio | Updated text prepared for the site's default content. **The live Privacy Policy page needs the same update**, ideally with legal review (section 8) |

## 7. Live test checklist (5 minutes, once)

Use a real inbox you can check. For each of **Book Table, Birthdays, Christmas and Contact**:

1. Fill in the form on your phone and send it. You should see the thank-you message.
2. hello@hotrockhove.com receives the staff email with all your answers. Press Reply: it should address you.
3. Your inbox receives the confirmation with the Hot Rock logo and a copy of your details.
4. In the admin, **Form submissions** shows the enquiry with the right form name, date and number of guests.
5. **Archive** (or delete) the test.

If an email doesn't arrive, check **Email & notifications → Email log** for the reason.

## 8. Privacy Policy wording to add on the live site

Add under *What we collect and why*:

> **Birthday and Christmas enquiries:** your name, email address, phone number, preferred date, number of guests, what you're planning and any special requirements, so we can reply with availability and options and arrange your booking. Special requirements may include dietary or allergy information; we use it only to prepare for your visit.
>
> When you send any of our forms we email you a confirmation with a copy of the details you sent.

Under *Lawful basis*, add birthday and Christmas enquiries to "taking steps at your request", and:

> Where you tell us about allergies or dietary needs, we use that information only with your explicit consent, given when you include it, to cater for you safely.

Under *Who processes your data*, add "text messages through Twilio". Under *How long we keep it*, note that birthday and Christmas enquiries are kept for up to 12 months.
