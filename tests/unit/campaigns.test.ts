import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldsSchema, formKeyFromName, submissionValidator } from "../../src/domain/forms/fields";
import { sectionsSchema } from "../../src/domain/sections";

/* ------------------------------ enquiry forms ------------------------------ */

test("form keys come from the name and match the field-name rules", () => {
  assert.equal(formKeyFromName("Birthday enquiry"), "birthday_enquiry");
  assert.equal(formKeyFromName("  Christmas at HotRock! "), "christmas_at_hotrock");
  assert.equal(formKeyFromName("2025 Party"), "party");
  assert.equal(formKeyFromName("!!!"), "");
  assert.ok(formKeyFromName("x".repeat(80)).length <= 40);
});

test("number fields accept whole numbers from 1 to 1000 only", () => {
  const v = submissionValidator(fieldsSchema.parse([{ name: "guests", label: "Number of guests", type: "number", required: true }]));
  assert.equal(v.safeParse({ guests: "12" }).success, true);
  for (const bad of ["0", "-1", "2.5", "ten", "1001", ""]) assert.equal(v.safeParse({ guests: bad }).success, false, bad);
});

test("optional number fields may be left empty", () => {
  const v = submissionValidator(fieldsSchema.parse([{ name: "guests", label: "Guests", type: "number", required: false }]));
  assert.equal(v.safeParse({ guests: "" }).success, true);
});

/* ------------------------------ page sections ------------------------------ */

const card = { id: "c1", title: "Birthday Package", body: "[To be confirmed]", priceText: "", mediaId: "", cta: { label: "Enquire", href: "#form-birthday_enquiry" } };

test("package cards validate, including links to a form anchor", () => {
  const r = sectionsSchema.safeParse([{ id: "s1", hidden: false, type: "cards", eyebrow: "", heading: "Packages", body: "", cards: [card] }]);
  assert.equal(r.success, true);
});

test("package cards reject unsafe links and more than 12 cards", () => {
  const bad = { ...card, cta: { label: "x", href: "javascript:alert(1)" } };
  assert.equal(sectionsSchema.safeParse([{ id: "s1", hidden: false, type: "cards", eyebrow: "", heading: "", body: "", cards: [bad] }]).success, false);
  const many = Array.from({ length: 13 }, (_, i) => ({ ...card, id: `c${i}` }));
  assert.equal(sectionsSchema.safeParse([{ id: "s1", hidden: false, type: "cards", eyebrow: "", heading: "", body: "", cards: many }]).success, false);
});

test("products section validates", () => {
  const r = sectionsSchema.safeParse([{ id: "s1", hidden: false, type: "products", eyebrow: "", heading: "Merch", body: "", cta: { label: "Ask about this", href: "/contact" } }]);
  assert.equal(r.success, true);
});
