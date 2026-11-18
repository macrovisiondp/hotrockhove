import { test } from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import { anchorFor, normaliseBase, qrFileName, qrUrl } from "../../src/domain/qr";

/* --------------------------------- QR codes -------------------------------- */

test("website address: https added, trailing parts dropped, junk refused", () => {
  assert.equal(normaliseBase("hotrockhove.com"), "https://hotrockhove.com");
  assert.equal(normaliseBase("https://hotrockhove.vercel.app/"), "https://hotrockhove.vercel.app");
  assert.equal(normaliseBase("  https://www.hotrockhove.com/our-menus?x=1 "), "https://www.hotrockhove.com");
  assert.equal(normaliseBase("http://localhost:3000"), "http://localhost:3000");
  assert.equal(normaliseBase(""), null);
  assert.equal(normaliseBase("not a site"), null);
  assert.equal(normaliseBase("javascript:alert(1)"), null);
});

test("links go to the page, with an anchor for items", () => {
  const base = "https://hotrockhove.com";
  assert.equal(qrUrl(base, { path: "/" }), "https://hotrockhove.com/");
  assert.equal(qrUrl(base, { path: "/birthdays" }), "https://hotrockhove.com/birthdays");
  assert.equal(
    qrUrl(base, { path: "/our-menus", anchor: anchorFor.menuItem("abc") }),
    "https://hotrockhove.com/our-menus#item-abc",
  );
  assert.equal(qrUrl(base, { path: "daisy", anchor: anchorFor.offer("x1") }), "https://hotrockhove.com/daisy#offer-x1");
  assert.equal(anchorFor.product("hr-mug"), "product-hr-mug");
});

test("download names are safe", () => {
  assert.equal(qrFileName("Wagyu Fillet (Steaks)"), "qr-wagyu-fillet-steaks");
  assert.equal(qrFileName("Daisy's Offers"), "qr-daisy-s-offers");
  assert.equal(qrFileName("Café & Bar"), "qr-cafe-and-bar");
  assert.equal(qrFileName("!!!"), "qr-hot-rock");
});

test("the QR code library encodes the full link", async () => {
  const url = qrUrl("https://hotrockhove.com", { path: "/our-menus", anchor: anchorFor.menuItem("abc") });
  const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  assert.match(svg, /^<svg/);
  const png = await QRCode.toDataURL(url, { width: 256 });
  assert.match(png, /^data:image\/png;base64,/);
});
