/**
 * Seed the database with the content migrated from hotrockhove.com (audit of
 * 2026-10-20). Safe to re-run: existing rows are left alone unless --force is
 * passed for a specific group (e.g. `npm run db:seed -- --force=pages`).
 *
 * Run `npm run media:import` first so pages can reference the migrated media.
 *
 * Content rules: original wording is preserved; nothing is invented. Business
 * details are imported from the live footer and flagged "unconfirmed" until an
 * admin confirms them. Data-quality issues become review notes, not edits.
 */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { count, eq } from "drizzle-orm";
import { db, t } from "../src/db";
import { importMenuItem, type SnapshotItem } from "../src/domain/menu-import";
import type { Section } from "../src/domain/sections";
import { sectionsSchema } from "../src/domain/sections";
import { fieldsSchema, type FormField } from "../src/domain/forms/fields";
import { DEFAULTS, saveSetting, type BusinessSettings } from "../src/lib/settings";
import { MEDIA_ALT } from "./data/media-alt";
import { classifyRights, GALLERY_PATHS, WP_UPLOADS } from "./data/media-manifest";

const force = new Set(
  process.argv
    .filter((a) => a.startsWith("--force="))
    .flatMap((a) => a.slice(8).split(","))
    .filter(Boolean),
);
const id = () => randomUUID().slice(0, 8);

/* -------------------------------------------------------------------------- */
/* Media lookup                                                               */
/* -------------------------------------------------------------------------- */

let mediaBySource: Map<string, string>;
async function loadMedia() {
  const rows = await db.select({ id: t.mediaAssets.id, sourceUrl: t.mediaAssets.sourceUrl }).from(t.mediaAssets);
  mediaBySource = new Map(rows.filter((r) => r.sourceUrl).map((r) => [r.sourceUrl!, r.id]));
  // Files that were byte-identical to an already-imported file point at that asset.
  try {
    const report = JSON.parse(await readFile("docs/data/media-migration-report.json", "utf8")) as {
      items: { path: string; status: string; id?: string }[];
    };
    for (const i of report.items) if (i.status === "duplicate-of" && i.id) mediaBySource.set(WP_UPLOADS + i.path, i.id);
  } catch {
    /* no report yet */
  }
}
const missingMedia = new Set<string>();
function m(path: string): string {
  const v = mediaBySource.get(WP_UPLOADS + path);
  if (!v) missingMedia.add(path);
  return v ?? "";
}

/** Alt text and provisional rights for migrated media. Never overwrites an admin's edits. */
async function seedMediaMeta() {
  const rows = await db.select().from(t.mediaAssets);
  let alt = 0;
  let rights = 0;
  for (const r of rows) {
    if (!r.sourceUrl?.startsWith(WP_UPLOADS)) continue;
    const rel = r.sourceUrl.slice(WP_UPLOADS.length);
    const a = MEDIA_ALT[rel];
    if (a && (r.altStatus === "missing" || force.has("media"))) {
      await db.update(t.mediaAssets).set({ alt: a.alt, altStatus: a.review ? "needs_review" : "ok" }).where(eq(t.mediaAssets.id, r.id));
      alt++;
    }
    const c = classifyRights(rel);
    // Only update rows still carrying an automatic note (an admin may have confirmed rights since).
    if (r.updatedAt.getTime() - r.createdAt.getTime() < 1000 && (r.rightsStatus !== c.status || r.rightsNote !== c.note)) {
      await db.update(t.mediaAssets).set({ rightsStatus: c.status, rightsNote: c.note }).where(eq(t.mediaAssets.id, r.id));
      rights++;
    }
  }
  if (alt || rights) console.log(`  media: alt text ${alt}, rights ${rights}`);
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

async function seedSettings() {
  const existing = await db.select({ key: t.settings.key }).from(t.settings);
  const have = new Set(existing.map((r) => r.key));
  const put = async <K extends keyof typeof DEFAULTS>(key: K, value: (typeof DEFAULTS)[K]) => {
    if (have.has(key) && !force.has("settings")) return;
    await saveSetting(key, value);
    console.log(`  settings.${key}`);
  };

  // From the live footer and contact page (2026-10-20). Marked unconfirmed: the
  // audit found conflicting hours and an Instagram handle for Portsmouth.
  const business: BusinessSettings = {
    ...DEFAULTS.business,
    name: "Hot Rock Hove",
    tagline: "The UK's premier Wagyu steakhouse, serving exclusive Wagyu cuts.",
    phone: "01273569060",
    email: "hello@hotrockhove.com",
    addressLine1: "141 Church Road",
    town: "Hove",
    postcode: "BN3 2AE",
    country: "United Kingdom",
    mapUrl: "https://www.google.com/maps/search/?api=1&query=141%20Church%20Road%2C%20Hove%20BN3%202AE",
    hours: [
      { day: "mon", closed: false, opens: "16:30", closes: "22:00" },
      { day: "tue", closed: false, opens: "16:30", closes: "22:00" },
      { day: "wed", closed: false, opens: "16:30", closes: "22:00" },
      { day: "thu", closed: false, opens: "16:30", closes: "22:00" },
      { day: "fri", closed: false, opens: "16:30", closes: "22:00" },
      { day: "sat", closed: false, opens: "12:00", closes: "22:00" },
      { day: "sun", closed: false, opens: "12:00", closes: "21:00" },
    ],
    bookTableUrl: "", // separate booking project; set in Business settings when ready
    facebookUrl: "https://www.facebook.com/share/1CC74r87Kn/",
    instagramUrl: "https://www.instagram.com/hotrock_portsmouth",
    tiktokUrl: "https://www.tiktok.com/@hot.rock.steakhouse",
    confirmed: { contact: false, hours: false, socials: false },
  };
  await put("business", business);
  await put("brand", DEFAULTS.brand);
  await put("notifications", { recipients: [] }); // info@ vs hello@ to be decided by the owner (audit C3)
  await put("email", { ...DEFAULTS.email, fromName: "Hot Rock Hove" });
  await put("seo", {
    ...DEFAULTS.seo,
    defaultDescription:
      "Welcome to Hot Rock, the home of the finest hand-selected, free-range, organic grass-fed beef and meats, cooked on lava rocks in Hove.",
    defaultOgImage: "",
  });
  await put("consent", DEFAULTS.consent);
  await put("features", DEFAULTS.features);
  // Local disk in development (ALLOW_LOCAL_STORAGE=true); S3 otherwise (configured in the admin).
  await put("storage", { ...DEFAULTS.storage, provider: process.env.ALLOW_LOCAL_STORAGE === "true" ? "local" : "s3" });
}

/* -------------------------------------------------------------------------- */
/* Forms                                                                      */
/* -------------------------------------------------------------------------- */

const f = (x: Partial<FormField> & Pick<FormField, "name" | "label" | "type">): FormField => ({
  required: false,
  placeholder: "",
  help: "",
  options: [],
  maxLength: 500,
  half: false,
  ...x,
});

const FORMS = [
  {
    key: "contact",
    name: "Contact",
    // Gravity Forms #3 (51 entries) + the duplicate Elementor form (same fields), consolidated.
    fields: [
      f({ name: "name", label: "Name", type: "text", maxLength: 120, half: true }),
      f({ name: "email", label: "Email", type: "email", required: true, maxLength: 254, half: true }),
      f({ name: "message", label: "Message", type: "textarea", required: true, maxLength: 4000 }),
    ],
    submitLabel: "Submit",
    successMessage: "Thank you for contacting us! We will get in touch with you shortly.",
    adminSubject: "New Contact Form Submission: {{name}}",
    sendAcknowledgement: true,
    ackSubject: "We have received your inquiry",
    ackBody:
      "Hello {{name}},\n\nThank you for contacting us! We have received your message and will get in touch with you shortly.\n\nKind regards,\n{{brandName}}",
    retentionDays: 365,
  },
  {
    key: "fan_club",
    name: "Daisy's Fan Club",
    // Gravity Forms #1 (93 entries). Consent checkbox added: the original collected
    // contact details for marketing without recording consent (audit C2).
    fields: [
      f({ name: "full_name", label: "Full Name", type: "text", required: true, maxLength: 120 }),
      f({ name: "email", label: "Email", type: "email", required: true, maxLength: 254, half: true }),
      f({ name: "phone", label: "Phone", type: "tel", required: true, maxLength: 20, half: true }),
      f({ name: "birthday_note", label: "Just to send gift on your birthday", type: "note" }),
      f({ name: "birth_day", label: "Birth Day", type: "select", required: true, options: Array.from({ length: 31 }, (_, i) => String(i + 1)), half: true }),
      f({
        name: "birth_month",
        label: "Birth Month",
        type: "select",
        required: true,
        half: true,
        options: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      }),
      f({
        name: "marketing_consent",
        label: "I'd like to join Daisy's Fan Club and receive offers and birthday treats from Hot Rock Hove by email, phone or text. I can opt out at any time.",
        type: "checkbox",
        required: true,
      }),
    ],
    submitLabel: "Submit",
    successMessage: "Thank you for joining Daisy's Fan Club!",
    adminSubject: "New Daisy Pop Up Form Submission: {{full_name}}",
    sendAcknowledgement: false,
    ackSubject: "",
    ackBody: "",
    retentionDays: 730,
  },
  {
    key: "table_request",
    name: "Book Table",
    // Gravity Forms #4 (10 entries). Kept as the fallback when no booking-system URL is set.
    fields: [
      f({ name: "full_name", label: "Full Name", type: "text", required: true, maxLength: 120 }),
      f({ name: "phone", label: "Phone Number", type: "tel", required: true, maxLength: 20, half: true }),
      f({ name: "email", label: "Email Address", type: "email", required: true, maxLength: 254, half: true }),
      f({ name: "date", label: "Reservation Date", type: "date", required: true, half: true }),
      f({ name: "time", label: "Reservation Time", type: "time", required: true, half: true }),
      f({
        name: "guests",
        label: "Number of Guests",
        type: "select",
        required: true,
        half: true,
        options: ["1 Guest", "2 Guests", "3 Guests", "4 Guests", "5 Guests", "6+ Guests"],
      }),
      f({
        name: "occasion",
        label: "Occasion",
        type: "select",
        half: true,
        options: ["Birthday 🎉", "Anniversary ❤️", "Date Night 🥂", "Business Meeting 💼", "Family Dinner 👨‍👩‍👧‍👦", "Other"],
      }),
      f({ name: "requests", label: "Special Requests", type: "textarea", placeholder: "Allergies, high chair, celebration setup, etc.", maxLength: 2000 }),
      f({ name: "contact_consent", label: "I agree to be contacted regarding my reservation.", type: "checkbox", required: true }),
    ],
    submitLabel: "Submit",
    successMessage:
      "Thanks for choosing Hot Rock Steaks. Your table request has been successfully submitted. A member of our team will reach out shortly to confirm your reservation. Got any changes or special requests? Feel free to contact us anytime. See you soon for an amazing steak experience!",
    adminSubject: "New submission from Book Table",
    sendAcknowledgement: false,
    ackSubject: "",
    ackBody: "",
    retentionDays: 180,
  },
];

async function seedForms() {
  for (const form of FORMS) {
    fieldsSchema.parse(form.fields);
    const exists = await db.query.forms.findFirst({ where: eq(t.forms.key, form.key) });
    if (exists && !force.has("forms")) continue;
    if (exists) await db.update(t.forms).set(form).where(eq(t.forms.key, form.key));
    else await db.insert(t.forms).values({ ...form, enabled: true, notifyAdmin: true, recipients: [] });
    console.log(`  form ${form.key}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Menu & offers                                                              */
/* -------------------------------------------------------------------------- */

async function seedMenu() {
  const [{ n }] = await db.select({ n: count() }).from(t.menuItems);
  if (n > 0 && !force.has("menu")) return;
  if (n > 0) {
    await db.delete(t.menuItems);
    await db.delete(t.menuCategories);
  }
  const snapshot = JSON.parse(await readFile("scripts/data/menu-snapshot.json", "utf8")) as {
    categories: { name: string; note?: string; items: SnapshotItem[] }[];
  };
  let items = 0;
  for (const [ci, cat] of snapshot.categories.entries()) {
    const [row] = await db
      .insert(t.menuCategories)
      .values({ name: cat.name, note: cat.note ?? "", sortOrder: ci * 10 })
      .returning({ id: t.menuCategories.id });
    for (const [ii, raw] of cat.items.entries()) {
      const it = importMenuItem(raw);
      const featured = ["Premium A5+9 Wagyu Fillet Steak", "Premium A5+9 Wagyu Sirloin Steak", "Tomahawk Steak", "Porterhouse Steak", "Fillet Steak", "Hot Rock Gourmet Wagyu Burger"].includes(it.name);
      const extraNote =
        cat.name === "SPECIAL OPENING OFFER" ? "Listed under 'Special opening offer' on the old site. Confirm it still applies." : "";
      await db.insert(t.menuItems).values({
        categoryId: row.id,
        name: it.name,
        description: it.description,
        prices: it.prices,
        sourcePriceText: it.sourcePriceText,
        featured,
        imageId: it.name === "Premium A5+9 Wagyu Fillet Steak" ? m("2026/02/ourm-h.jpg") || null : null,
        sortOrder: ii * 10,
        reviewNote: [it.reviewNote, extraNote].filter(Boolean).join(" "),
      });
      items++;
    }
  }
  console.log(`  menu: ${snapshot.categories.length} categories, ${items} items`);
}

async function seedOffers() {
  const [{ n }] = await db.select({ n: count() }).from(t.offers);
  if (n > 0 && !force.has("offers")) return;
  if (n > 0) await db.delete(t.offers);
  const rows = [
    {
      title: "Mad Monday's",
      tagline: "Cancel your plans, Mad Monday returns!",
      body: "9oz* Premium Rump Steak & Beef Dripping Chips\nA Rocktail of your choice for ONLY",
      priceText: "£19.99",
      promoCode: "MADMONDAY",
      imageId: m("2026/02/madm.jpg") || null,
      reviewNote:
        "The old Daisy page also said 'Hot Rock is back in Pompey! … no bookings, first come first serve … every Monday except bank holidays' (Portsmouth wording, and it contradicts 'Book now using code'). Confirm the Hove terms.",
    },
    {
      title: "Tenderloin Tuesday's",
      tagline: "Tuesday just got tender!",
      body: "Our hand-selected Tenderloin is the most tender cut of all,\nsizzled exactly how you like it on your very own Hot Rock.\nTreat yourself this and EVERY Tuesday.\nBook Now and ask about our Tenderloin Tuesday offer",
      priceText: "",
      promoCode: "",
      imageId: null,
      reviewNote: "",
    },
    {
      title: "Wagyu Wednesday's",
      tagline: "Every wondered what the VERY best beef in the world tastes like.",
      body: "Our handpicked Wagyu is 20% off this and EVERY Wednesday!\nSensational on the taste's buds, easy on the pocket.",
      priceText: "",
      promoCode: "WAGYU",
      imageId: m("2026/02/wagyud.jpg") || null,
      reviewNote: "Tagline 'Every wondered' kept as on the old site (likely 'Ever wondered'). Confirm.",
    },
    {
      title: "Fillet Friday's",
      tagline: "Fillets are fillets right? WRONG!",
      body: "A lot of time, care and love goes into the preparation of a Hot Rock Fillet.\nNot only is our Barrel Rolled Fillet the PREMIUM choice of steak cuts,\nit's also discounted for that Friday feeling\n9oz* of Steak bliss awaits you.\n\n*All weights are approximate",
      priceText: "",
      promoCode: "FILLETFRIDAY",
      imageId: m("2026/02/fillet-fri-enh.jpg") || null,
      reviewNote: "The menu lists 'Fillet Friday' at £29.99 as a special opening offer. Confirm whether to show a price here.",
    },
  ];
  for (const [i, r] of rows.entries()) await db.insert(t.offers).values({ ...r, sortOrder: i * 10, stage: "current" });
  console.log(`  offers: ${rows.length}`);
}

/* -------------------------------------------------------------------------- */
/* Pages                                                                      */
/* -------------------------------------------------------------------------- */

const cta = (label = "", href = "") => ({ label, href });

const FOUNDER_STORY = `Welcome to Hot Rock, the home of the finest hand-selected, free-range, organic grass-fed beef and meats served in the British Isles, cooked on lava rocks in a cooking tradition as old as time itself.

I personally have travelled the world to source for you the unrivalled Wagyu and beef cuts on offer to you today.

My love for the world's finest beef is shared by my dedicated team of passionate chefs who will carefully hand-select your chosen steak, and by our enthusiastic front-of-house team, who are here to help you get the very best from the rock and your personal Hot Rock adventure.

My late father's mantra drummed into me four decades ago when I started out as a kitchen hand was and remains to this day:

*'It's not just a meal, it's an experience'*

Welcome to Hot Rock, Welcome to Steak.`;

const WAGYU_STORY = `Frustrated by the inconsistencies in the UK supply network, and low-grade Wagyu being passed off as premium, I said to myself there simply must be another way to get the very best premium Wagyu consistently to my discerning patrons.

So, as you do, I jumped on a 14-hour flight to Japan 😊

Exceptional Wagyu, no doubt — but supply issues would have put me right back where I started with UK suppliers, so it was back to the UK.

I did a little digging, and one name, or rather one area, consistently kept coming up. So, in the name of research and research alone, I hopped on a flight down under 😊

Just so you appreciate what I went through to get there — not including getting to the airport and waiting for my flight, or getting off, picking up some wheels, and finding my hotel — add another 9 hours:
UK to Beijing: 10 hours
3 hours in transit
Beijing to Sydney: 12 hours

Some much-needed sleep (that journey is brutal on your senses), followed by a 12-hour drive north to Casino, NSW, to see a $1m Wagyu slaughter and boning facility!`;

const WAGYU_STORY_2 = `On my journey up the Gold Coast, at one point I'd driven 45 minutes without seeing another car — but what I did see were thousands upon thousands of our bovine friends roaming freely in the vast, sun-drenched fields, chewing on the fresh green grass-just as Mother Nature had intended!

To cut a long story short, the very next day I attended a $1M Full Blood Wagyu slaughter that I had been invited to. And what a sight it was, wagyu on a different level to anything I had ever seen anywhere in the world, apart from Japan, and the premium A5 +9 Full Blood Wagyu that I saw there, is the same wagyu that I have the pleasure in serving to you in Hot Rock, here today.`;

const PRIVACY = `This notice explains what personal information Hot Rock Hove ("we", "us") collects through this website, why, and what your rights are. You can contact us about it using the details on our Contact page.

**What we collect and why**
Contact form: your name (optional), email address and message, so we can reply to you.
Table requests: your name, phone number, email address, the date, time and size of your booking, the occasion and any special requests, so we can arrange your table and contact you about it.
Daisy's Fan Club: your name, email address, phone number and the day and month of your birthday, so we can enter you into fan-club prize draws and send you offers and a birthday treat. We only do this with your consent, which you can withdraw at any time.
Newsletter: your email address and a record of your consent, so we can send you offers and news. We ask you to confirm by email first, and every email has an unsubscribe link.

**Lawful basis**
We rely on your consent for the fan club and newsletter, on taking steps at your request for table requests, and on our legitimate interest in answering enquiries for the contact form.

**Who processes your data for us**
Our website is hosted by Vercel, our database by Neon, emails are sent through Resend, images and videos are stored by Cloudinary, and Cloudflare Turnstile helps protect our forms from spam. These providers act on our instructions. Some of them may process data outside the UK under appropriate safeguards.

**How long we keep it**
Enquiries are kept for up to 12 months, table requests for up to 6 months, and fan-club details for up to 2 years or until you ask us to remove them. Newsletter subscriptions are kept until you unsubscribe.

**Cookies**
We use an essential cookie to remember your cookie choice. With your permission we also load optional third-party content, such as our Google reviews widget, and may measure visits. You can change your choice at any time using "Cookie preferences" at the bottom of every page.

**Your rights**
You can ask to see, correct or delete your information, object to its use, or withdraw consent at any time. If you're unhappy with how we've handled your information you can complain to the Information Commissioner's Office (ico.org.uk).`;

type PageSeed = {
  slug: string;
  title: string;
  status: "draft" | "published";
  system: boolean;
  seoTitle?: string;
  seoDescription?: string;
  reviewNote?: string;
  sections: Section[];
};

function pages(): PageSeed[] {
  return [
    {
      slug: "",
      title: "Home",
      status: "published",
      system: true,
      seoTitle: "Hot Rock Hove | Wagyu steakhouse on Church Road, Hove",
      seoDescription:
        "Welcome to Hot Rock, the home of the finest hand-selected, free-range, organic grass-fed beef and meats, cooked on lava rocks in Hove.",
      sections: [
        {
          id: id(),
          hidden: false,
          type: "hero",
          eyebrow: "",
          heading: "It's not just a meal, it's an experience",
          body: "The UK's premier Wagyu steakhouse, serving exclusive Wagyu cuts.",
          mediaId: m("2025/10/WhatsApp-Image-2025-10-13-at-17.18.00_5b182930.jpg"),
          videoId: "",
          primaryCta: cta("Book Table", "book"),
          secondaryCta: cta("See Our Menu", "/our-menus"),
        },
        {
          id: id(),
          hidden: false,
          type: "story",
          eyebrow: "Simply irresistible",
          heading: "Steak Perfection",
          body: FOUNDER_STORY,
          signature: "Sonny",
          signatureRole: "(The Steak Sheikh) Executive Chef & Hot Rock Founder",
          mediaId: m("2025/10/WhatsApp-Image-2025-10-13-at-17.18.00_3281e347-e1760462301109.jpg"),
          imageSide: "left",
          cta: cta("Learn More", "/wagyu"),
        },
        {
          id: id(),
          hidden: false,
          type: "video",
          eyebrow: "",
          heading: "Wagyu journey",
          body: "I travelled to the other side of the world to find the very best beef and Wagyu just for you!\n\nA5 +9 Full Blood Wagyu. GM free, grass-fed cattle, just as mother nature intended!\n\nThis is the video of the Wagyu being cut. The 10-thousand-mile journey was 10 thousand percent worth it! This is the Premium Wagyu fillet served at Hot Rock Steakhouse!",
          videoId: m("2026/02/WhatsApp-Video-2026-02-07-at-10.09.54-PM.mp4"),
          mediaId: m("2026/02/WhatsApp-Image-2026-02-07-at-10.09.58-PM-1.jpeg"),
        },
        {
          id: id(),
          hidden: false,
          type: "menuHighlights",
          eyebrow: "",
          heading: "Satisfy Your Cravings",
          body: "",
          cta: cta("See Our Menu", "/our-menus"),
        },
        { id: id(), hidden: false, type: "reviews", eyebrow: "", heading: "Customers Testimonials" },
        {
          id: id(),
          hidden: false,
          type: "gallery",
          eyebrow: "",
          heading: "The Culinary Canvas",
          mediaIds: [
            "2026/02/WhatsApp-Image-2026-02-07-at-10.09.56-PM-1.jpeg",
            "2026/02/WhatsApp-Image-2026-02-11-at-11.34.35-AM-1.jpeg",
            "2026/02/Apple-Rocktail.jpeg",
            "2026/02/WhatsApp-Image-2026-02-07-at-10.09.54-PM-2.jpeg",
            "2026/02/WhatsApp-Image-2026-02-07-at-10.09.58-PM-1.jpeg",
            "2026/02/WhatsApp-Image-2026-02-04-at-8.27.44-PM.jpeg",
            "2026/02/WhatsApp-Image-2026-02-11-at-11.42.40-AM.jpeg",
            "2026/02/Blueberry-Rocktail.jpeg",
          ]
            .map(m)
            .filter(Boolean),
          limit: 8,
          cta: cta("View Gallery", "/gallery"),
        },
        {
          id: id(),
          hidden: false,
          type: "visit",
          eyebrow: "",
          heading: "Our location",
          body: "",
          mediaId: m("2026/02/WhatsApp-Image-2026-02-04-at-10.19.04-PM.jpeg"),
        },
        {
          id: id(),
          hidden: false,
          type: "newsletter",
          heading: "Don't Miss the Sizzle",
          body: "Subscribe for mouth-watering offers.",
        },
      ],
    },
    {
      slug: "our-menus",
      title: "Our Menu",
      status: "published",
      system: true,
      seoTitle: "Our Menu",
      seoDescription: "The UK's premier Wagyu steakhouse, serving exclusive Wagyu cuts. See our starters, steaks, burgers, sides, desserts and drinks.",
      sections: [{ id: id(), hidden: false, type: "menu", eyebrow: "", heading: "Our Menu", body: "" }],
    },
    {
      slug: "daisy",
      title: "Daisy's Offers",
      status: "published",
      system: false,
      seoTitle: "Daisy's Offers",
      seoDescription:
        "Daisy isn't just a mascot — she's a legend. Meet Daisy and see our weekly Hot Rock offers: Mad Monday, Tenderloin Tuesday, Wagyu Wednesday and Fillet Friday.",
      reviewNote: "Fan-club prize draw says 'T + C's Apply' but no terms page exists. Publish the terms before launch.",
      sections: [
        {
          id: id(),
          hidden: false,
          type: "story",
          eyebrow: "",
          heading: "Meat Daisy, Our Bovine Offers Mascot",
          body: "Daisy isn't just a mascot — she's a legend. Over the years, she's journeyed from pasture to platter, ensuring every steak that lands on your plate is nothing short of extraordinary.\n\nYou might notice Daisy looks a little… different here on our menu. That's because she's fully committed to sharing herself with our guests — in perfectly portioned, sizzling pieces.\n\nFrom juicy Ribeye's to tender fillets, every cut tells Daisy's story: a tale of dedication, flavour, and the finest hand-selected beef the world has to offer.\n\nSo, raise a fork to Daisy — she may be in pieces, but her spirit lives on in every Hot Rock experience.",
          signature: "",
          signatureRole: "",
          mediaId: m("2026/01/daisy3.jpg"),
          imageSide: "right",
          cta: cta(),
        },
        { id: id(), hidden: false, type: "offers", eyebrow: "Our current offers", heading: "Daisy's Hot Rock Offers", body: "" },
        {
          id: id(),
          hidden: false,
          type: "form",
          eyebrow: "",
          heading: "Join Daisy's Fan Club",
          body: "For a chance to win £200 towards your future Hot Rock experiences. (T + C's Apply)",
          formKey: "fan_club",
          showContact: false,
        },
      ],
    },
    {
      slug: "gallery",
      title: "Gallery",
      status: "published",
      system: false,
      seoTitle: "Gallery",
      seoDescription: "Photos and videos from Hot Rock Hove: Wagyu, steaks on the rock, Rocktails and the restaurant.",
      sections: [
        { id: id(), hidden: false, type: "gallery", eyebrow: "", heading: "Gallery", mediaIds: GALLERY_PATHS.map(m).filter(Boolean), limit: 0, cta: cta() },
      ],
    },
    {
      slug: "contact",
      title: "Contact",
      status: "published",
      system: true,
      seoTitle: "Contact Us",
      seoDescription: "Contact Hot Rock Hove, 141 Church Road, Hove BN3 2AE. Call, email or send us a message.",
      sections: [
        {
          id: id(),
          hidden: false,
          type: "form",
          eyebrow: "",
          heading: "Contact Us",
          body: "Please let us know what's on your mind. Have a question for us? Ask away.",
          formKey: "contact",
          showContact: true,
        },
      ],
    },
    {
      slug: "wagyu",
      title: "Wagyu",
      status: "published",
      system: false,
      seoTitle: "Our Wagyu",
      seoDescription:
        "Frustrated by the inconsistencies in the UK supply network, and low-grade Wagyu being passed off as premium, I said to myself there simply must be another way.",
      sections: [
        {
          id: id(),
          hidden: false,
          type: "hero",
          eyebrow: "Wagyu",
          heading: "On a mission to find the very best Wagyu the world has to offer",
          body: "",
          mediaId: m("2026/02/wagyuim.jpg"),
          videoId: "",
          primaryCta: cta("Book Table", "book"),
          secondaryCta: cta(),
        },
        {
          id: id(),
          hidden: false,
          type: "story",
          eyebrow: "",
          heading: "Over the past few years, I've been on a mission to find the very best Wagyu the world has to offer.",
          body: WAGYU_STORY,
          signature: "",
          signatureRole: "",
          mediaId: m("2026/02/WhatsApp-Image-2026-02-07-at-10.09.53-PM.jpeg"),
          imageSide: "left",
          cta: cta(),
        },
        {
          id: id(),
          hidden: false,
          type: "quote",
          quote:
            "Casino, NSW, is a significant rural town in Australia's Northern Rivers region, known as Australia's Beef Capital due to its large cattle industry.",
          attribution: "Casino, New South Wales",
        },
        { id: id(), hidden: false, type: "text", eyebrow: "", heading: "", body: WAGYU_STORY_2, align: "left" },
        {
          id: id(),
          hidden: false,
          type: "cta",
          heading: "If you're a true steak connoisseur, our Wagyu is a must have!",
          body: "",
          mediaId: m("2026/02/wagyud.jpg"),
          primaryCta: cta("Book Table", "book"),
          secondaryCta: cta("See Our Menu", "/our-menus"),
        },
      ],
    },
    {
      slug: "book-table",
      title: "Book Table",
      status: "published",
      system: true,
      seoTitle: "Book a Table",
      seoDescription: "Request a table at Hot Rock Hove.",
      reviewNote: "Used only while no booking-system URL is set in Business settings. Requests are confirmed by the team by phone or email.",
      sections: [
        { id: id(), hidden: false, type: "form", eyebrow: "", heading: "Book Table", body: "", formKey: "table_request", showContact: true },
      ],
    },
    {
      slug: "privacy-policy",
      title: "Privacy Policy",
      status: "published",
      system: true,
      seoTitle: "Privacy Policy",
      seoDescription: "How Hot Rock Hove uses personal information collected through this website.",
      reviewNote: "Drafted from the site's actual data practices. Needs owner (ideally legal) review before launch.",
      sections: [{ id: id(), hidden: false, type: "text", eyebrow: "", heading: "", body: PRIVACY, align: "left" }],
    },
    {
      slug: "about-us",
      title: "About Us",
      status: "draft",
      system: false,
      reviewNote:
        "Draft for approval. The old About page was theme demo copy (\"Grand Restaurant\", \"wood-fired grill\") and was not migrated. This draft reuses only verified text from the homepage founder story.",
      sections: [
        {
          id: id(),
          hidden: false,
          type: "story",
          eyebrow: "About us",
          heading: "Welcome to Hot Rock, Welcome to Steak.",
          body: FOUNDER_STORY,
          signature: "Sonny",
          signatureRole: "(The Steak Sheikh) Executive Chef & Hot Rock Founder",
          mediaId: m("2025/10/WhatsApp-Image-2025-10-13-at-17.18.00_5b182930.jpg"),
          imageSide: "left",
          cta: cta("Our Wagyu", "/wagyu"),
        },
      ],
    },
    {
      slug: "valentines",
      title: "Valentine's",
      status: "draft",
      system: false,
      reviewNote: "Seasonal campaign from February 2026. Update dates and publish when the next Valentine's campaign starts.",
      sections: [
        {
          id: id(),
          hidden: false,
          type: "hero",
          eyebrow: "Valentines Day",
          heading: "Treat Your Loved One to the Ultimate Hot Rock Experience",
          body: "Book early to avoid heartache!",
          mediaId: m("2026/02/val.jpg"),
          videoId: "",
          primaryCta: cta("Book Now", "book"),
          secondaryCta: cta(),
        },
        {
          id: id(),
          hidden: false,
          type: "text",
          eyebrow: "",
          heading: "",
          body: "The season of love is upon us, if you REALLY want to show your loved one how much you love them then there is no better way than treating your loved one to the Ultimate Hot Rock experience. Love will be in the air while you tuck into the best steak in the south. Start booking early to avoid disappointment, book early to avoid heartache!\n\nAt Hot Rock it's not just a meal, it's an experience!",
          align: "center",
        },
      ],
    },
  ];
}

async function seedPages() {
  for (const p of pages()) {
    sectionsSchema.parse(p.sections);
    const exists = await db.query.pages.findFirst({ where: eq(t.pages.slug, p.slug) });
    if (exists && !force.has("pages")) continue;
    const values = {
      slug: p.slug,
      title: p.title,
      status: p.status,
      system: p.system,
      sections: p.sections,
      seoTitle: p.seoTitle ?? "",
      seoDescription: p.seoDescription ?? "",
      reviewNote: p.reviewNote ?? "",
      publishedAt: p.status === "published" ? new Date() : null,
    };
    if (exists) await db.update(t.pages).set(values).where(eq(t.pages.id, exists.id));
    else await db.insert(t.pages).values(values);
    console.log(`  page /${p.slug}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Navigation, redirects, pop-ups                                             */
/* -------------------------------------------------------------------------- */

async function seedNav() {
  const [{ n }] = await db.select({ n: count() }).from(t.navItems);
  if (n > 0 && !force.has("nav")) return;
  if (n > 0) await db.delete(t.navItems);
  const header: [string, string][] = [
    ["Home", "/"],
    ["Our Menu", "/our-menus"],
    ["Daisy's Offers", "/daisy"],
    ["Gallery", "/gallery"],
    ["Contact", "/contact"],
    ["Wagyu", "/wagyu"],
    ["Book Table", "book"],
  ];
  const footer: [string, string][] = [
    ["Home", "/"],
    ["Our Menus", "/our-menus"],
    ["Daisy's Offers", "/daisy"],
    ["Gallery", "/gallery"],
    ["Privacy Policy", "/privacy-policy"],
  ];
  for (const [i, [label, href]] of header.entries()) await db.insert(t.navItems).values({ location: "header", label, href, sortOrder: i * 10 });
  for (const [i, [label, href]] of footer.entries()) await db.insert(t.navItems).values({ location: "footer", label, href, sortOrder: i * 10 });
  console.log("  navigation");
}

/** docs/MIGRATION_PLAN.md §4. */
const REDIRECTS: { fromPath: string; toPath: string; statusCode: number; prefix?: boolean; note: string }[] = [
  { fromPath: "/reservations", toPath: "book", statusCode: 302, note: "MotoPress booking demo page" },
  { fromPath: "/hotrockhove", toPath: "/", statusCode: 301, note: "Pre-opening waiting-list page (restaurant now open)" },
  { fromPath: "/shop", toPath: "/our-menus", statusCode: 301, note: "WooCommerce shop never launched" },
  { fromPath: "/product", toPath: "/our-menus", statusCode: 301, prefix: true, note: "WooCommerce product (Family Feast)" },
  { fromPath: "/cart", toPath: "/our-menus", statusCode: 301, note: "WooCommerce" },
  { fromPath: "/checkout", toPath: "/our-menus", statusCode: 301, note: "WooCommerce" },
  { fromPath: "/my-account", toPath: "/our-menus", statusCode: 301, note: "WooCommerce" },
  { fromPath: "/about-us", toPath: "/wagyu", statusCode: 302, note: "Temporary while the new About Us draft awaits approval. Remove when it's published." },
  { fromPath: "/valentines", toPath: "/daisy", statusCode: 302, note: "Seasonal page is a draft. Remove when the next campaign is published." },
  { fromPath: "/sample-page", toPath: "", statusCode: 410, note: "WordPress default page" },
  { fromPath: "/employee", toPath: "", statusCode: 410, prefix: true, note: "MotoPress demo content" },
  { fromPath: "/location", toPath: "", statusCode: 410, prefix: true, note: "MotoPress demo content" },
  { fromPath: "/service", toPath: "", statusCode: 410, prefix: true, note: "MotoPress demo content" },
  { fromPath: "/album", toPath: "", statusCode: 410, prefix: true, note: "Sonaar audio playlist" },
  { fromPath: "/sitemap_index.xml", toPath: "/sitemap.xml", statusCode: 301, note: "Rank Math sitemap index" },
  { fromPath: "/page-sitemap.xml", toPath: "/sitemap.xml", statusCode: 301, note: "Rank Math sitemap" },
  { fromPath: "/wp-sitemap.xml", toPath: "/sitemap.xml", statusCode: 301, note: "WordPress core sitemap" },
  { fromPath: "/product-sitemap.xml", toPath: "", statusCode: 410, note: "Rank Math sitemap" },
  { fromPath: "/mpa_employee-sitemap.xml", toPath: "", statusCode: 410, note: "Rank Math sitemap" },
  { fromPath: "/mpa_location-sitemap.xml", toPath: "", statusCode: 410, note: "Rank Math sitemap" },
  { fromPath: "/mpa_service-sitemap.xml", toPath: "", statusCode: 410, note: "Rank Math sitemap" },
  { fromPath: "/sr_playlist-sitemap.xml", toPath: "", statusCode: 410, note: "Rank Math sitemap" },
  { fromPath: "/feed", toPath: "", statusCode: 410, prefix: true, note: "WordPress RSS feed" },
  { fromPath: "/wp-login.php", toPath: "", statusCode: 410, note: "WordPress login (not used by the new site)" },
  { fromPath: "/wp-admin", toPath: "", statusCode: 410, prefix: true, note: "WordPress admin (not used by the new site)" },
  { fromPath: "/wp-content", toPath: "", statusCode: 410, prefix: true, note: "Old WordPress uploads; media now served from Cloudinary" },
];

async function seedRedirects() {
  let added = 0;
  for (const r of REDIRECTS) {
    const res = await db
      .insert(t.redirects)
      .values({ ...r, prefix: r.prefix ?? false })
      .onConflictDoNothing({ target: t.redirects.fromPath })
      .returning({ id: t.redirects.id });
    added += res.length;
  }
  if (added) console.log(`  redirects: ${added}`);
}

async function seedPopups() {
  const [{ n }] = await db.select({ n: count() }).from(t.popups);
  if (n > 0 && !force.has("popups")) return;
  if (n > 0) await db.delete(t.popups);
  // Elementor pop-ups #4500 ("opening") and #4662 ("daisypop"): page load + 2 s, once per session.
  await db.insert(t.popups).values([
    {
      name: "Homepage newsletter (from WordPress 'opening')",
      enabled: true,
      template: "image_side",
      heading: "The UK's premier Wagyu steakhouse, serving exclusive Wagyu cuts.",
      body: "Don't Miss the Sizzle — Subscribe for Mouth-Watering Offers !",
      imageId: m("2026/01/Instagram-post-132.jpg.jpeg") || null,
      formKey: "newsletter",
      pages: ["/"],
      trigger: "delay",
      delaySeconds: 2,
      frequency: "session",
      priority: 10,
    },
    {
      name: "Daisy's Fan Club (from WordPress 'daisypop')",
      enabled: true,
      template: "text_only",
      heading: "Join Daisy's Fan Club",
      body: "For a chance to win £200 towards your future Hot Rock experiences. (T + C's Apply)",
      formKey: "fan_club",
      pages: ["/daisy"],
      trigger: "delay",
      delaySeconds: 2,
      frequency: "session",
      priority: 20,
    },
  ]);
  console.log("  pop-ups: 2");
}

async function main() {
  await loadMedia();
  console.log(`Seeding (media available: ${mediaBySource.size})…`);
  await seedSettings();
  await seedMediaMeta();
  await seedForms();
  await seedMenu();
  await seedOffers();
  await seedPages();
  await seedNav();
  await seedRedirects();
  await seedPopups();
  if (missingMedia.size) console.warn(`\n${missingMedia.size} media file(s) not imported yet; run npm run media:import, then re-seed with --force=pages,offers,popups.`);
  console.log("Done. If the dev server is running, run npm run cache:clear and restart it to see the changes.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
