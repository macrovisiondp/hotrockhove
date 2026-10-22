import { expect, test } from "@playwright/test";
import { acceptEssentialCookies, alerts, signIn, suppressPopups, waitForForms } from "./helpers";

test.beforeEach(async ({ context, baseURL }) => {
  await acceptEssentialCookies(context, baseURL!);
  await suppressPopups(context);
});

test("admin requires sign-in and rejects wrong passwords", async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto("/admin/business");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.fill("#email", process.env.DEV_ADMIN_EMAIL!);
  await page.fill("#password", "definitely-wrong-password");
  await page.click("button[type=submit]");
  await expect(alerts(page)).toContainText("Email or password is incorrect");
  await ctx.close();
});

test("admin APIs refuse anonymous and forged requests", async ({ playwright, baseURL }) => {
  // A fresh context: no shared admin session.
  const request = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  expect((await request.get("/api/admin/media")).status()).toBe(401);
  expect((await request.get("/api/cron/retention")).status()).toBe(401);
  // Signed-out visitors are sent to the login page by the proxy…
  const r = await request.get("/admin/export/submissions", { maxRedirects: 0 });
  expect(r.status()).toBe(307);
  expect(r.headers().location).toMatch(/\/admin\/login$/);
  // …and a forged session cookie gets past the proxy but is refused by the route itself.
  const forged = await request.get("/admin/export/submissions", {
    maxRedirects: 0,
    headers: { cookie: "better-auth.session_token=forged.value" },
  });
  expect(forged.status()).toBe(403);
  await request.dispose();
});

test("Business settings change appears on the public site, then is restored", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/business");
  await waitForForms(page);
  const phone = page.locator("#fld-phone");
  const original = await phone.inputValue();
  await phone.fill("01273 111 222");
  await page.getByRole("button", { name: "Save changes" }).first().click();
  await expect(page.getByRole("status").first()).toContainText(/Updated: phone/);

  await page.goto("/contact");
  await expect(page.locator("footer").getByRole("link", { name: "01273 111 222" })).toHaveAttribute("href", "tel:01273111222");

  await page.goto("/admin/business");
  await waitForForms(page);
  await page.locator("#fld-phone").fill(original);
  await page.getByRole("button", { name: "Save changes" }).first().click();
  await expect(page.getByRole("status").first()).toContainText(/Updated: phone/);
});

test("Business settings validation blocks bad values", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/business");
  await waitForForms(page);
  await page.locator("#fld-email").fill("not-an-email");
  await page.getByRole("button", { name: "Save changes" }).first().click();
  await expect(alerts(page).first()).toContainText(/correct the highlighted/i);
  await expect(page.locator("#fld-email-err")).toBeVisible();
});

test("menu price edit shows on the menu page, then is restored", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/menu");
  await page.getByRole("link", { name: "Garlic Bread", exact: true }).click();
  await page.waitForURL(/\/admin\/menu\/items\//);
  await waitForForms(page);
  const price = page.locator('[id="fld-price.0.amount"]');
  await expect(price).toHaveValue("4.99");
  await price.fill("5.25");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").first()).toContainText("Item saved");

  await page.goto("/our-menus");
  await expect(page.locator("h4", { hasText: /^Garlic Bread$/ }).locator("xpath=..")).toContainText("£5.25");

  await page.goto("/admin/menu");
  await page.getByRole("link", { name: "Garlic Bread", exact: true }).click();
  await page.waitForURL(/\/admin\/menu\/items\//);
  await waitForForms(page);
  await page.locator('[id="fld-price.0.amount"]').fill("4.99");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").first()).toContainText("Item saved");
});

test("API keys are encrypted and never sent back to the browser", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/email");
  await waitForForms(page);
  const key = `re_e2etest_${Date.now()}`;
  const providerForm = () => page.locator("form", { has: page.locator("#fld-resendApiKey") });
  await page.locator("#fld-resendApiKey").fill(key);
  await providerForm().getByRole("button", { name: "Save changes" }).click();
  await expect(providerForm().getByRole("status")).toContainText(/Saved/);
  await page.reload();
  await waitForForms(page);
  const html = await page.content();
  expect(html).not.toContain(key);
  await expect(page.getByText(`••••${key.slice(-4)}`)).toBeVisible();
  // Remove the test key again.
  await providerForm().getByLabel("Remove stored key").check();
  await providerForm().getByRole("button", { name: "Save changes" }).click();
  await expect(providerForm().getByRole("status")).toContainText(/Saved/);
});

test("draft pages are not public but can be previewed by staff", async ({ page, request }) => {
  expect((await request.get("/valentines", { maxRedirects: 0 })).status()).toBe(302); // temporary redirect while draft
  await signIn(page);
  await page.goto("/admin/pages");
  await page.getByRole("link", { name: "Valentine's" }).click();
  const previewHref = await page.getByRole("link", { name: "Preview" }).getAttribute("href");
  await page.goto(previewHref!);
  await expect(page.locator("h1")).toContainText("Ultimate Hot Rock Experience");
  await expect(page.getByText(/draft, not visible to visitors/)).toBeVisible();
});

test("role permissions are enforced on the server", async ({ page, browser, baseURL }) => {
  await signIn(page);
  await page.goto("/admin/users");
  await waitForForms(page);
  const email = `viewer-${Date.now()}@hotrockhove.test`;
  const add = page.locator("form", { has: page.getByRole("button", { name: "Create account" }) });
  await add.locator("#fld-name").fill("E2E Viewer");
  await add.locator("#fld-email").fill(email);
  await add.locator("#fld-role").selectOption("viewer");
  await add.getByRole("button", { name: "Create account" }).click();
  const banner = await add.getByRole("status").textContent();
  const password = banner!.match(/\(shown once\): (\S+)\./)![1];

  // Explicitly empty: contexts would otherwise inherit the shared owner session.
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  await ctx.addCookies([{ name: "hr_consent", value: "essential", url: baseURL! }]);
  const viewer = await ctx.newPage();
  await viewer.goto(`${baseURL}/admin/login`);
  await viewer.fill("#email", email);
  await viewer.fill("#password", password);
  await viewer.click("button[type=submit]");
  await viewer.waitForURL(/\/admin$/);
  // No users page, no submissions.
  await viewer.goto(`${baseURL}/admin/users`);
  await expect(viewer).toHaveURL(/error=forbidden/);
  expect((await viewer.request.get(`${baseURL}/admin/export/submissions`)).status()).toBe(403);
  // Read-only settings: the form is disabled.
  await viewer.goto(`${baseURL}/admin/business`);
  await expect(viewer.getByText(/Only owners and admins can change them/)).toBeVisible();
  await expect(viewer.locator("#fld-phone")).toBeDisabled();
  await ctx.close();

  // Clean up: deactivate the test viewer.
  await page.reload();
  await waitForForms(page);
  const card = page.locator("section", { hasText: email });
  await card.getByLabel("Can sign in").uncheck();
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("status")).toContainText(/signed out/);
});

test("dashboard shows connection status; Connections page has a form per service", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Connections" })).toBeVisible();
  await expect(page.getByText("Email (Resend)")).toBeVisible();
  await page.getByRole("link", { name: "Open Connections" }).click();
  await waitForForms(page);
  await expect(page.getByLabel("Resend API key")).toBeVisible();
  await expect(page.getByLabel("Secret key")).toBeVisible();
  await expect(page.getByLabel("Booking page address")).toBeVisible();
  await expect(page.getByLabel("Measurement ID")).toBeVisible();
});

test("media storage settings explain the S3 setup; videos accept a poster", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/media/settings");
  await waitForForms(page);
  await expect(page.getByLabel("Bucket name")).toBeVisible();
  await expect(page.getByText('PublicReadSiteMedia')).toBeVisible();
  await expect(page.getByText('"AllowedMethods"')).toBeVisible();
  await page.goto("/admin/media?type=video");
  await page.locator("ul a[href^='/admin/media/']").first().click();
  await page.waitForURL(/\/admin\/media\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Poster image" })).toBeVisible();
});
