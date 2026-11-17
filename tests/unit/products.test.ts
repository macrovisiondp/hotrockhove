import { test } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_SLUG_RE, slugify } from "../../src/domain/products";

/* ------------------------------- products ------------------------------- */

test("product slugs are made from the name", () => {
  assert.equal(slugify("HR Chopper"), "hr-chopper");
  assert.equal(slugify("HR Espresso Cup & Saucer"), "hr-espresso-cup-saucer");
  assert.equal(slugify("  Café -- Mug!  "), "cafe-mug");
  assert.equal(slugify("&&&"), "");
});

test("generated slugs always pass the slug rule", () => {
  for (const name of ["HR Mug", "Ü-ber  Grill 2000", "a".repeat(200) + " b"]) {
    const s = slugify(name);
    assert.match(s, PRODUCT_SLUG_RE);
    assert.ok(s.length <= 80);
  }
  assert.doesNotMatch("HR-Mug", PRODUCT_SLUG_RE);
  assert.doesNotMatch("hr--mug", PRODUCT_SLUG_RE);
  assert.doesNotMatch("-hr-mug", PRODUCT_SLUG_RE);
});
