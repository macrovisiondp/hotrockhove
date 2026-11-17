import { test } from "node:test";
import assert from "node:assert/strict";
import { notificationsSchema, recipientsForForm } from "../../src/domain/notifications";
import { firstNameOf } from "../../src/domain/forms/fields";
import { layout } from "../../src/lib/email/templates";

/* ------------------------------- recipients ------------------------------- */

test("old plain-address settings become 'all notifications' recipients", () => {
  const r = notificationsSchema.parse({ recipients: ["Hello@HotRockHove.com"] });
  assert.deepEqual(r.recipients, [{ email: "hello@hotrockhove.com", name: "", types: ["all"] }]);
});

test("each address gets only the forms it's ticked for, plus 'all' and the form's extras", () => {
  const { recipients } = notificationsSchema.parse({
    recipients: [
      { email: "hello@hotrockhove.com", types: ["all"] },
      { email: "events@hotrockhove.com", name: "Events", types: ["form:birthday_enquiry", "form:christmas_enquiry"] },
      { email: "kitchen@hotrockhove.com", types: ["form:table_request"] },
    ],
  });
  assert.deepEqual(recipientsForForm(recipients, "birthday_enquiry"), ["hello@hotrockhove.com", "events@hotrockhove.com"]);
  assert.deepEqual(recipientsForForm(recipients, "table_request"), ["hello@hotrockhove.com", "kitchen@hotrockhove.com"]);
  assert.deepEqual(recipientsForForm(recipients, "contact", ["Owner@Example.com", "hello@hotrockhove.com"]), ["hello@hotrockhove.com", "owner@example.com"]);
});

test("recipient list rejects duplicates, bad addresses, unknown types and empty choices", () => {
  const bad = [
    [{ email: "a@b.co", types: ["all"] }, { email: "A@B.co", types: ["all"] }],
    [{ email: "not-an-email", types: ["all"] }],
    [{ email: "a@b.co", types: ["form:Bad-Key"] }],
    [{ email: "a@b.co", types: [] }],
  ];
  for (const recipients of bad) assert.equal(notificationsSchema.safeParse({ recipients }).success, false, JSON.stringify(recipients));
});

/* ------------------------------ email content ------------------------------ */

test("greetings use the first name from full_name or name", () => {
  assert.equal(firstNameOf({ full_name: "  Sam  Taylor " }), "Sam");
  assert.equal(firstNameOf({ name: "Priya" }), "Priya");
  assert.equal(firstNameOf({ email: "x@y.z" }), "");
});

const brand = {
  name: "Hot Rock Hove",
  logoUrl: "https://www.hotrockhove.com/brand/logo-email.png",
  accent: "#ba9774",
  siteUrl: "https://www.hotrockhove.com",
  address: "141 Church Road, Hove, BN3 2AE",
  phone: "01273569060",
  email: "hello@hotrockhove.com",
};

test("branded emails show the logo, accent and contact footer", () => {
  const { html, text } = layout({ brandName: brand.name, brand, eyebrow: "Birthday enquiry", heading: "Thank you", paragraphs: ["Hello,"], rows: [["Guests", "8"]], rowsTitle: "Your details" });
  assert.match(html, /<img src="https:\/\/www\.hotrockhove\.com\/brand\/logo-email\.png"[^>]*alt="Hot Rock Hove"/);
  assert.match(html, /#ba9774/);
  assert.match(html, /141 Church Road, Hove, BN3 2AE/);
  assert.match(text, /Your details\nGuests: 8/);
});

test("email content is escaped and unsafe colours or links are ignored", () => {
  const { html } = layout({
    brandName: "X",
    brand: { ...brand, accent: "red;background:url(x)", logoUrl: "javascript:alert(1)" },
    heading: "<script>alert(1)</script>",
    paragraphs: ['<img src=x onerror="alert(1)">'],
    cta: { label: "Go", url: "javascript:alert(1)" },
  });
  assert.doesNotMatch(html, /<script>|onerror="|javascript:|url\(x\)/);
  assert.match(html, /&lt;script&gt;/);
});
