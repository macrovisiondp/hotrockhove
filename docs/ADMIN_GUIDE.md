# Website Admin Guide

For Hot Rock Hove staff. Sign in at **hotrockhove.com/admin** (until launch: the preview address you've been given).

## Roles

| Role | Can do |
|---|---|
| Owner | Everything, including users and API keys |
| Admin | Business settings, forms, email, SEO, redirects, submissions and subscribers |
| Editor | Pages, menu, offers, media, pop-ups, navigation; can read submissions |
| Viewer | Look only |

Change your password under **My account** (bottom left).

## Everyday tasks

**Change phone, email, address or opening hours.** Go to Business settings, edit, then press **Save changes**. Every page, the footer, contact page and Google data update immediately.

**Change a price or dish.** Menu → click the dish → edit → Save. Untick "Available" to hide something temporarily. "Featured" puts it in the homepage highlights. Items marked **Review** came from the old website with something odd (e.g. "£5:99"); fix them and tick "Mark as reviewed".

**Weekly offers.** Offers → click an offer. Add start and end dates for anything temporary; it appears and disappears by itself.

**Photos and videos.** Media → Upload. Then open each file and write a short description of what it shows (this is read aloud to blind visitors and helps Google). Mark the usage rights. A file can't be deleted while a page uses it.

**Edit a page.** Pages → choose the page. Each block (hero, story, gallery…) opens when clicked. Use the arrows to reorder and the eye to hide a block. Press **Save changes**. Use **Preview** to check a draft. Published pages update at once.

**Packages (birthday, Christmas…).** In a page, add a **Packages / cards** block. Each card has a title, text, an optional price line ("£45 per person"), photo and button. To make a button jump to a form on the same page, link it to `#form-` plus the form's key, e.g. `#form-birthday_enquiry`.

**New enquiry form (owner/admin).** Forms → **Add a form** → give it a name (e.g. "Birthday enquiry"). Change its fields on the next screen (Number is useful for "Number of guests"), then put it on a page with a **Form** block.

**Merchandise.** Products → add or edit a product (photos, description, the price shown). Only published products appear, on any page with a **Products** block. The "price in £" and SKU fields are kept ready for an online shop later and aren't shown yet.

**Campaign pages and the menu bar.** Draft pages (Birthdays, Christmas at HotRock, Merchandise, Franchise) are only visible through **Preview**. When one is approved: publish it, then in Navigation tick its link's "Visible" box. With more than six links, the menu bar switches to the menu button on screens narrower than a large laptop.

**Book Table button.** When the new booking system is ready, paste its web address in Connections → Booking system. Until then, the button opens the table-request form.

**Connections (owner).** One page for the services the site uses: email (Resend), text messages (Twilio), spam protection (Cloudflare Turnstile), the booking link and Google Analytics. Paste the details, press **Save** and it takes effect straight away. Keys are stored encrypted and only the last 4 characters are ever shown.

**Pop-ups.** Pop-ups → choose one. Set where it shows, when (delay, scroll or leaving the page), how often, and start and end dates. Keep them rare.

**Read enquiries.** Form submissions. New ones are bold; opening one marks it read. "Reply by email" opens your email app. Use Delete for erasure requests. Submissions are deleted automatically after the retention period set on each form.

**Newsletter.** People are only "Subscribed" after clicking the link in their confirmation email. Confirmed subscribers are included automatically in Marketing emails; legacy addresses (no consent record) never are.

**Marketing (owner/admin).** Marketing → **New email** or **New text message**. Write it, choose who gets it, press **Save**, send yourself a test, then **Send to N people**. Keep the page open while it sends (it shows progress; if you close it, open the campaign again to carry on — nobody gets it twice). Every email has an unsubscribe link and every text ends with "Reply STOP to opt out"; people who opt out are left out of everything from then on.

**Marketing contacts.** Marketing → Contacts → upload a CSV (columns like name, email, phone) or paste one contact per line. Only upload people who agreed to hear from you, and say how they agreed. Anyone who unsubscribed stays unsubscribed even if they're in a new upload. Texts cost money per message part (shown as you type).

**Email log.** Shows what the site emailed (notifications, confirmations) and why anything failed.

**Holiday hours or news.** Site settings → Announcement bar.

**Take the site offline briefly.** Site settings → Maintenance mode. Signed-in staff still see the site.

## Safety

- Never share your password. Owners can reset other people's passwords under Users.
- Submissions and subscribers are personal data: don't copy them anywhere unnecessary.
- Everything important you change is recorded in the Activity log.
