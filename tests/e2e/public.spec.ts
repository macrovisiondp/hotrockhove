import { expect, test } from "@playwright/test";
import { acceptEssentialCookies, suppressPopups } from "./helpers";

test.beforeEach(async ({ context, baseURL }) => {
  await acceptEssentialCookies(context, baseURL!);
  await suppressPopups(context);
});

const PAGES = [
  { path: "/", h1: /not just a meal/i },
  { path: "/our-menus", h1: /our menu/i },
  { path: "/daisy", h1: /daisy/i },
  { path: "/gallery", h1: /gallery/i },
  { path: "/contact", h1: /contact us/i },
  { path: "/wagyu", h1: /wagyu/i },
  { path: "/book-table", h1: /book table/i },
  { path: "/privacy-policy", h1: /privacy policy/i },
];

for (const p of PAGES) {
  test(`${p.path} renders with one h1 and no demo content`, async ({ page }) => {
    const res = await page.goto(p.path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(p.h1);
    const body = await page.locator("body").innerText();
    for (const demo of ["St. Moritz", "Grand Restaurant", "5434567633", "(343)454-4364", "Sample Page"]) expect(body).not.toContain(demo);
  });
}

test("desktop header: logo centred, links balanced either side", async ({ page }) => {
  await page.goto("/our-menus");
  const viewport = page.viewportSize()!;
  const logo = await page.getByRole("link", { name: "Hot Rock Hove home" }).boundingBox();
  expect(logo).not.toBeNull();
  const centre = logo!.x + logo!.width / 2;
  expect(Math.abs(centre - viewport.width / 2)).toBeLessThanOrEqual(2);
  const left = page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link");
  const right = page.getByRole("navigation", { name: "Primary, continued" }).getByRole("link");
  const [l, r] = [await left.count(), await right.count()];
  expect(Math.abs(l - r)).toBeLessThanOrEqual(1);
  // Nav fits on one line: every link shares the same vertical position.
  const ys = await page.locator("header nav a").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(ys).size).toBe(1);
});

test("menu shows all categories with prices exactly as imported", async ({ page }) => {
  await page.goto("/our-menus");
  await expect(page.getByRole("navigation", { name: "Menu categories" }).getByRole("link")).toHaveCount(11);
  const strawberry = page.locator("h4", { hasText: /^Strawberry$/ }).locator("xpath=..");
  await expect(strawberry).toContainText("£5:99");
  await expect(page.locator("h4", { hasText: "Premium A5+9 Wagyu Fillet Steak" }).locator("xpath=..")).toContainText("£119.99");
  await expect(page.locator("h4", { hasText: "Bottled water" }).locator("xpath=..")).toContainText("330ml £3.00 · 750ml £4.50");
});

test("footer reads business details from settings", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await expect(footer).toContainText("141 Church Road");
  await expect(footer.getByRole("link", { name: "01273569060" })).toHaveAttribute("href", "tel:01273569060");
  await expect(footer).toContainText("Monday to Friday");
});

test("restaurant structured data uses configured details only", async ({ page }) => {
  await page.goto("/");
  const json = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
  expect(json["@type"]).toBe("Restaurant");
  expect(json.address.postalCode).toBe("BN3 2AE");
  expect(json.telephone).toBe("01273569060");
  expect(json.openingHoursSpecification.length).toBe(7);
});

test("Book Table falls back to the table-request form while no booking URL is set", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header").getByRole("link", { name: "Book Table" })).toHaveAttribute("href", "/book-table");
});

test("redirects and removed pages", async ({ request }) => {
  const r1 = await request.get("/hotrockhove/", { maxRedirects: 0 });
  expect(r1.status()).toBe(301);
  expect(r1.headers().location).toMatch(/\/$/);
  const r2 = await request.get("/service/wedding/", { maxRedirects: 0 });
  expect(r2.status()).toBe(410);
  const r3 = await request.get("/shop/", { maxRedirects: 0 });
  expect(r3.status()).toBe(301);
  expect(r3.headers().location).toMatch(/\/our-menus$/);
  const r4 = await request.get("/this-page-does-not-exist");
  expect(r4.status()).toBe(404);
  // Old WordPress URLs with a trailing slash reach live pages in one hop.
  const r5 = await request.get("/our-menus/", { maxRedirects: 0 });
  expect(r5.status()).toBe(301);
  expect(r5.headers().location).toMatch(/\/our-menus$/);
});

test("not indexable before launch", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \//);
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
  expect(h["content-security-policy"]).toMatch(/frame-ancestors 'none'/);
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-powered-by"]).toBeUndefined();
});
