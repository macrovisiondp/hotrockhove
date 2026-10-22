import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { decryptSecret, encryptSecret, isEncrypted } from "../../src/lib/crypto";
import { DEFAULTS, formatTime, groupHours, maskSecret, mergeSecret, validateSetting } from "../../src/lib/settings";
import { formatPrices, matchRedirect, normalisePath } from "../../src/domain/content";
import { emailConfigIssues } from "../../src/lib/email/providers";
import { escapeHtml, layout } from "../../src/lib/email/templates";

// Server modules read these lazily (at call time), so setting them here is enough.
process.env.SETTINGS_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
process.env.BETTER_AUTH_SECRET ??= randomBytes(32).toString("base64");

test("secrets are encrypted at rest and round-trip", () => {
  const enc = encryptSecret("re_test_1234567890abcd");
  assert.ok(isEncrypted(enc));
  assert.ok(!enc.includes("re_test"));
  assert.equal(decryptSecret(enc), "re_test_1234567890abcd");
  // Tampering is detected (AES-GCM authentication).
  const tampered = enc.slice(0, -4) + (enc.endsWith("A") ? "B" : "A") + enc.slice(-3);
  assert.throws(() => decryptSecret(tampered));
});

test("secrets are masked for display and kept when the field is left empty", () => {
  const enc = encryptSecret("re_live_abcdefghijklmnop");
  assert.equal(maskSecret(enc), "••••mnop");
  assert.equal(maskSecret(""), null);
  assert.equal(mergeSecret(enc, ""), enc);
  assert.notEqual(mergeSecret(enc, "re_new_value_123456"), enc);
});

test("opening hours group consecutive identical days", () => {
  const hours = [
    { day: "mon", closed: false, opens: "16:30", closes: "22:00" },
    { day: "tue", closed: false, opens: "16:30", closes: "22:00" },
    { day: "wed", closed: false, opens: "16:30", closes: "22:00" },
    { day: "thu", closed: false, opens: "16:30", closes: "22:00" },
    { day: "fri", closed: false, opens: "16:30", closes: "22:00" },
    { day: "sat", closed: false, opens: "12:00", closes: "22:00" },
    { day: "sun", closed: true, opens: "12:00", closes: "21:00" },
  ] as const;
  assert.deepEqual(groupHours([...hours]), [
    { label: "Monday to Friday", value: "4:30pm - 10pm" },
    { label: "Saturday", value: "12pm - 10pm" },
    { label: "Sunday", value: "Closed" },
  ]);
  assert.equal(formatTime("00:15"), "12:15am");
});

test("business settings validation rejects bad values and accepts empty (unconfigured) ones", () => {
  assert.equal(validateSetting("business", DEFAULTS.business).success, true);
  assert.equal(validateSetting("business", { ...DEFAULTS.business, email: "not-an-email" }).success, false);
  assert.equal(validateSetting("business", { ...DEFAULTS.business, bookTableUrl: "http://insecure.example.com" }).success, false);
  assert.equal(validateSetting("business", { ...DEFAULTS.business, phone: "<script>" }).success, false);
  assert.equal(validateSetting("brand", { ...DEFAULTS.brand, accentColour: "red" }).success, false);
});

test("redirect matching: exact, trailing slash, case and prefix rules", () => {
  const rules = [
    { fromPath: "/hotrockhove", prefix: false },
    { fromPath: "/service", prefix: true },
    { fromPath: "/service/wedding", prefix: false },
  ];
  assert.equal(normalisePath("/Shop/?x=1"), "/shop");
  assert.equal(matchRedirect(rules, "/hotrockhove/")?.fromPath, "/hotrockhove");
  assert.equal(matchRedirect(rules, "/service/open-house")?.fromPath, "/service");
  assert.equal(matchRedirect(rules, "/service/wedding")?.fromPath, "/service/wedding");
  assert.equal(matchRedirect(rules, "/services"), null);
  assert.equal(matchRedirect(rules, "/"), null);
});

test("menu prices display: exact source text when unreadable", () => {
  assert.equal(formatPrices([{ label: null, amountPence: 1099 }], "£10.99"), "£10.99");
  assert.equal(formatPrices([{ label: null, amountPence: null }], "£5:99"), "£5:99");
  assert.equal(
    formatPrices(
      [
        { label: "330ml", amountPence: 300 },
        { label: "750ml", amountPence: 450 },
      ],
      "",
    ),
    "330ml £3.00 · 750ml £4.50",
  );
});

test("email readiness lists every missing piece and nothing once configured", () => {
  const issues = emailConfigIssues(DEFAULTS.email);
  assert.ok(issues.some((i) => /Resend API key/.test(i)));
  assert.ok(issues.some((i) => /Sender address/.test(i)));
  assert.ok(issues.some((i) => /switched off/.test(i)));
  const ready = { ...DEFAULTS.email, resendApiKey: encryptSecret("re_x_1234567890"), fromAddress: "no-reply@hotrockhove.com", deliveryEnabled: true, lastTestOk: true };
  assert.deepEqual(emailConfigIssues(ready), []);
});

test("emails escape submitted content", () => {
  assert.equal(escapeHtml(`<img src=x onerror="a">`), "&lt;img src=x onerror=&quot;a&quot;&gt;");
  const { html } = layout({ brandName: "Hot Rock", heading: "New", paragraphs: [], rows: [["Message", "<script>alert(1)</script>"]] });
  assert.ok(!html.includes("<script>"));
});

test("site address falls back to Vercel's variables", async () => {
  const { resolveAppUrl, deploymentOrigins } = await import("../../src/lib/env");
  assert.equal(resolveAppUrl({ APP_URL: "https://hotrockhove.com/" }), "https://hotrockhove.com");
  assert.equal(resolveAppUrl({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "hotrockhove.com" }), "https://hotrockhove.com");
  assert.equal(resolveAppUrl({ VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "app-git-x.vercel.app", VERCEL_URL: "app-abc.vercel.app" }), "https://app-git-x.vercel.app");
  assert.equal(resolveAppUrl({}), "http://localhost:3000");
  assert.deepEqual(deploymentOrigins({ VERCEL_BRANCH_URL: "b.vercel.app", VERCEL_URL: "d.vercel.app" }), ["https://b.vercel.app", "https://d.vercel.app"]);
});

test("S3 public URLs: bucket URL by default, CDN when set, keys URL-encoded per segment", async () => {
  const { s3PublicBase, s3PublicUrl, s3ObjectKey } = await import("../../src/lib/storage");
  const base = { ...DEFAULTS.storage, provider: "s3" as const, s3: { ...DEFAULTS.storage.s3, bucket: "hotrock-media", region: "eu-west-2" } };
  assert.equal(s3PublicBase(base), "https://hotrock-media.s3.eu-west-2.amazonaws.com");
  assert.equal(s3PublicBase({ ...base, s3: { ...base.s3, publicBaseUrl: "https://media.hotrockhove.com/" } }), "https://media.hotrockhove.com");
  assert.equal(s3PublicBase({ ...base, s3: { ...base.s3, endpoint: "https://acct.r2.cloudflarestorage.com" } }), "https://acct.r2.cloudflarestorage.com/hotrock-media");
  assert.equal(s3ObjectKey("hotrockhove", "2026/10/a b.jpg"), "hotrockhove/2026/10/a b.jpg");
  assert.equal(s3PublicUrl("https://x.example", "hotrockhove/2026/a b+c.jpg"), "https://x.example/hotrockhove/2026/a%20b%2Bc.jpg");
});

test("Neon public URLs: endpoint/bucket by default, CDN when set", async () => {
  const { neonPublicBase } = await import("../../src/lib/storage");
  const s = { ...DEFAULTS.storage, neon: { bucket: "hotrockhove", prefix: "site", publicBaseUrl: "" } };
  assert.equal(neonPublicBase(s, "https://br-x.storage.c-6.us-east-2.aws.neon.tech/"), "https://br-x.storage.c-6.us-east-2.aws.neon.tech/hotrockhove");
  assert.equal(neonPublicBase({ ...s, neon: { ...s.neon, publicBaseUrl: "https://media.hotrockhove.com/" } }, "https://ignored"), "https://media.hotrockhove.com");
});

test("storage settings: Neon is the default and http URLs are rejected", () => {
  assert.equal(DEFAULTS.storage.provider, "neon");
  assert.equal(DEFAULTS.storage.neon.bucket, "hotrockhove");
  assert.equal(validateSetting("storage", DEFAULTS.storage).success, true);
  assert.equal(validateSetting("storage", { ...DEFAULTS.storage, s3: { ...DEFAULTS.storage.s3, publicBaseUrl: "http://insecure.example" } }).success, false);
});

test("sections saved before the hero style / map / tour options still parse, with safe defaults", async () => {
  const { parseSections } = await import("../../src/domain/sections");
  const cta = { label: "", href: "" };
  const { sections, invalid } = parseSections([
    { id: "h", hidden: false, type: "hero", eyebrow: "", heading: "Hi", body: "", mediaId: "", videoId: "", primaryCta: cta, secondaryCta: cta },
    { id: "v", hidden: false, type: "visit", eyebrow: "", heading: "Our location", body: "", mediaId: "" },
    { id: "t", hidden: false, type: "tour", eyebrow: "", heading: "See what's coming", body: "" },
  ]);
  assert.equal(invalid, 0);
  assert.equal(sections[0].type === "hero" && sections[0].mediaStyle, "cover");
  assert.equal(sections[1].type === "visit" && sections[1].showMap, false);
  assert.equal(sections[2].type, "tour");
  assert.equal(parseSections([{ id: "h", hidden: false, type: "hero", eyebrow: "", heading: "", body: "", mediaId: "", videoId: "", mediaStyle: "spin", primaryCta: cta, secondaryCta: cta }]).invalid, 1);
});

test("CSP allows the Google map frame, and the tour host only when given", async () => {
  const { buildCsp } = await import("../../src/lib/csp");
  const frameSrc = (csp: string) => csp.split("; ").find((d) => d.startsWith("frame-src")) ?? "";
  assert.match(frameSrc(buildCsp("n", { isDev: false })), /https:\/\/www\.google\.com/);
  assert.doesNotMatch(frameSrc(buildCsp("n", { isDev: false })), /3d66/);
  assert.match(frameSrc(buildCsp("n", { isDev: false, frameOrigins: ["https://vr.3d66.com"] })), /https:\/\/vr\.3d66\.com/);
});

test("homepage sound URLs must be https", () => {
  assert.equal(validateSetting("features", { ...DEFAULTS.features, homeSoundsEnabled: true, sizzleSoundUrl: "https://x.example/s.mp3" }).success, true);
  assert.equal(validateSetting("features", { ...DEFAULTS.features, mooSoundUrl: "http://x.example/m.mp3" }).success, false);
});
