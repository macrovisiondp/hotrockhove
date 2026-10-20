import { test } from "node:test";
import assert from "node:assert/strict";
import { importMenuItem, parsePriceInput } from "../../src/domain/menu-import";
import { submissionValidator, displayRows, fieldsSchema, type FormField } from "../../src/domain/forms/fields";
import { linkHref, sectionsSchema, blankSection, SECTION_TYPES } from "../../src/domain/sections";
import { csvCell, toCsv } from "../../src/lib/csv";
import { parseLondonLocal } from "../../src/lib/time";
import { can, PERMISSIONS } from "../../src/lib/rbac";

/* --------------------------------- menu --------------------------------- */

test("menu import keeps clean prices exactly", () => {
  const r = importMenuItem({ name: "Fillet Steak", description: "Approx 9oz", description_raw: "", price_raw: "£36.99" });
  assert.deepEqual(r.prices, [{ label: null, amountPence: 3699 }]);
  assert.equal(r.reviewNote, "");
});

test("menu import never guesses an unreadable price (£5:99)", () => {
  const r = importMenuItem({ name: "Strawberry", description: null, description_raw: null, price_raw: "£5:99" });
  assert.deepEqual(r.prices, [{ label: null, amountPence: null }]);
  assert.equal(r.sourcePriceText, "£5:99");
  assert.match(r.reviewNote, /£5:99/);
});

test("menu import flags Bradon Rost without renaming it", () => {
  const r = importMenuItem({ name: "Bradon Rost", description: "Hot roasted fillet of salmon", description_raw: "", price_raw: "£10.99" });
  assert.equal(r.name, "Bradon Rost");
  assert.match(r.reviewNote, /Bradan Rost/);
});

test("bottled water's two sizes become two prices with a review note", () => {
  const r = importMenuItem({ name: "Bottled water", description: "fizzy and still330ml", description_raw: "", price_raw: "£3.00 , 750ml £4.50" });
  assert.deepEqual(r.prices, [
    { label: "330ml", amountPence: 300 },
    { label: "750ml", amountPence: 450 },
  ]);
  assert.equal(r.description, "fizzy and still");
  assert.notEqual(r.reviewNote, "");
});

test("all 85 snapshot items import, and only known issues are flagged", async () => {
  const { readFile } = await import("node:fs/promises");
  const snap = JSON.parse(await readFile("scripts/data/menu-snapshot.json", "utf8")) as { categories: { items: Parameters<typeof importMenuItem>[0][] }[] };
  const items = snap.categories.flatMap((c) => c.items.map(importMenuItem));
  assert.equal(items.length, 85);
  const flagged = items.filter((i) => i.reviewNote).map((i) => i.name).sort();
  assert.deepEqual(flagged, ["Bottled water", "Bradon Rost", "Scampi", "Strawberry"].sort());
  // Every other item has exactly one readable price.
  for (const i of items.filter((x) => !x.reviewNote)) assert.ok(i.prices.length === 1 && i.prices[0].amountPence! > 0, i.name);
});

test("admin price input parsing", () => {
  assert.equal(parsePriceInput("12.99"), 1299);
  assert.equal(parsePriceInput("£12.99"), 1299);
  assert.equal(parsePriceInput("12"), 1200);
  assert.equal(parsePriceInput("12.5"), 1250);
  assert.equal(parsePriceInput("5:99"), null);
  assert.equal(parsePriceInput("-3"), null);
  assert.equal(parsePriceInput(""), null);
});

/* --------------------------------- forms -------------------------------- */

const contactFields: FormField[] = fieldsSchema.parse([
  { name: "name", label: "Name", type: "text", required: false },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "guests", label: "Guests", type: "select", required: true, options: ["1 Guest", "2 Guests"] },
  { name: "consent", label: "I agree", type: "checkbox", required: true },
  { name: "note", label: "Just a note", type: "note", required: false },
]);

test("form validation: required, email, select options, consent", () => {
  const v = submissionValidator(contactFields);
  const bad = v.safeParse({ name: "", email: "not-an-email", guests: "99 Guests", consent: "" });
  assert.equal(bad.success, false);
  const fields = new Set(bad.error!.issues.map((i) => i.path[0]));
  assert.ok(fields.has("email") && fields.has("guests") && fields.has("consent"));

  const ok = v.safeParse({ name: "  Ana ", email: "Ana@Example.COM", guests: "2 Guests", consent: "on" });
  assert.equal(ok.success, true);
  assert.equal(ok.data!.email, "ana@example.com");
  assert.equal(ok.data!.name, "Ana");
  assert.equal(ok.data!.consent, true);
});

test("form validation rejects over-long input", () => {
  const v = submissionValidator(fieldsSchema.parse([{ name: "message", label: "Message", type: "textarea", required: true, maxLength: 10 }]));
  assert.equal(v.safeParse({ message: "x".repeat(11) }).success, false);
});

test("field definitions must have unique names and dropdown options", () => {
  assert.equal(fieldsSchema.safeParse([{ name: "a", label: "A", type: "text", required: false }, { name: "a", label: "B", type: "text", required: false }]).success, false);
  assert.equal(fieldsSchema.safeParse([{ name: "a", label: "A", type: "select", required: false, options: [] }]).success, false);
});

test("submission display keeps values of removed fields", () => {
  const rows = displayRows(contactFields, { email: "a@b.co", consent: true, old_field: "kept" });
  assert.deepEqual(rows, [
    ["Email", "a@b.co"],
    ["I agree", "Yes"],
    ["old_field", "kept"],
  ]);
});

/* ------------------------------- sections ------------------------------- */

test("links: safe forms allowed, script URLs rejected", () => {
  for (const ok of ["", "book", "/our-menus", "/", "https://booking.example.com/x", "tel:01273569060", "mailto:hello@hotrockhove.com", "#menu"])
    assert.equal(linkHref.safeParse(ok).success, true, ok);
  for (const bad of ["javascript:alert(1)", "http://insecure.example.com", "//evil.example.com", "data:text/html,x", " /x y"])
    assert.equal(linkHref.safeParse(bad).success, false, bad);
});

test("every section type has a valid blank template", () => {
  const blanks = SECTION_TYPES.map((t, i) => blankSection(t, `id${i}`));
  assert.equal(sectionsSchema.safeParse(blanks).success, true);
});

/* ---------------------------------- csv --------------------------------- */

test("CSV neutralises spreadsheet formulas and quotes correctly", () => {
  assert.equal(csvCell("=HYPERLINK(\"x\")"), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell("+44 1273"), "'+44 1273");
  assert.equal(csvCell("@cmd"), "'@cmd");
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell(true), "Yes");
  assert.ok(toCsv(["A"], [["£5"]]).startsWith("﻿A\r\n£5"));
});

/* ---------------------------------- time -------------------------------- */

test("UK local times convert to UTC across daylight saving", () => {
  assert.equal(parseLondonLocal("2026-01-15T18:00")!.toISOString(), "2026-01-15T18:00:00.000Z"); // GMT
  assert.equal(parseLondonLocal("2026-07-15T18:00")!.toISOString(), "2026-07-15T17:00:00.000Z"); // BST
  assert.equal(parseLondonLocal("2026-13-01T00:00"), null);
  assert.equal(parseLondonLocal("2026-02-30T12:00"), null);
  assert.equal(parseLondonLocal("tomorrow"), null);
});

/* ---------------------------------- rbac -------------------------------- */

test("permission matrix: only owners manage users and secrets", () => {
  assert.equal(can("owner", "users.manage"), true);
  assert.equal(can("admin", "users.manage"), false);
  assert.equal(can("admin", "secrets.edit"), false);
  assert.equal(can("editor", "settings.edit"), false);
  assert.equal(can("editor", "content.edit"), true);
  assert.equal(can("viewer", "content.edit"), false);
  assert.equal(can("viewer", "submissions.view"), false);
  // Owners can do everything.
  for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) assert.equal(can("owner", p), true, p);
});
