import { expect, test } from "@playwright/test";
import { acceptEssentialCookies, alerts, signIn, suppressPopups } from "./helpers";

test.beforeEach(async ({ context, baseURL }) => {
  await acceptEssentialCookies(context, baseURL!);
  await suppressPopups(context);
});

test("contact form: server validation, then stored submission and logged email", async ({ page }) => {
  const unique = `e2e-${Date.now()}`;
  await page.goto("/contact");
  // Empty submit: server-side validation messages (the form uses noValidate).
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(alerts(page)).toContainText(/check the highlighted fields/i);
  await expect(page.locator("#f-email-err")).toBeVisible();
  await expect(page.locator("#f-message-err")).toBeVisible();

  await page.fill("#f-name", "E2E Tester");
  await page.fill("#f-email", "e2e@hotrockhove.test");
  await page.fill("#f-message", `Hello from ${unique}`);
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("status")).toContainText("Thank you for contacting us!");

  // It's stored and visible to staff.
  await signIn(page);
  await page.goto(`/admin/submissions?q=${unique}`);
  await expect(page.getByRole("row")).toHaveCount(2);
  await page.getByRole("row").nth(1).getByRole("link").click();
  await page.waitForURL(/\/admin\/submissions\/[0-9a-f-]{36}$/);
  await expect(page.locator("dd", { hasText: unique })).toBeVisible();
  // Delivery is switched off, so emails are logged as skipped, never silently lost.
  await expect(page.getByText(/skipped|failed|sent/).first()).toBeVisible();
});

test("honeypot: bots get a success message but nothing is stored", async ({ page }) => {
  const unique = `bot-${Date.now()}`;
  await page.goto("/contact");
  await page.fill("#f-email", "bot@example.com");
  await page.fill("#f-message", unique);
  await page.evaluate(() => {
    (document.querySelector('input[name="company_website"]') as HTMLInputElement).value = "http://spam.example";
  });
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await signIn(page);
  await page.goto(`/admin/submissions?q=${unique}`);
  await expect(page.getByText("No submissions")).toBeVisible();
});

test("table-request form keeps the original fields and confirmation", async ({ page }) => {
  await page.goto("/book-table");
  for (const label of ["Full Name", "Phone Number", "Email Address", "Reservation Date", "Reservation Time", "Number of Guests", "Occasion", "Special Requests"])
    await expect(page.getByLabel(label, { exact: false }).first()).toBeVisible();
  await page.fill("#f-full_name", "E2E Booker");
  await page.fill("#f-phone", "01273 000000");
  await page.fill("#f-email", "booker@hotrockhove.test");
  const d = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await page.fill("#f-date", d);
  await page.fill("#f-time", "19:30");
  await page.selectOption("#f-guests", "2 Guests");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(alerts(page)).toContainText(/check the highlighted/i); // consent box not ticked
  await page.check("#f-contact_consent");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("status")).toContainText("Your table request has been successfully submitted");
});

test("newsletter: consent required, then pending until confirmed", async ({ page }) => {
  const email = `news-${Date.now()}@hotrockhove.test`;
  await page.goto("/");
  const form = page.locator("form", { has: page.locator("#nl-email") });
  await form.locator("#nl-email").fill(email);
  await form.getByRole("button", { name: "Subscribe" }).click();
  await expect(alerts(form)).toContainText(/tick the box/i);
  await form.locator('input[name="consent"]').check();
  await form.getByRole("button", { name: "Subscribe" }).click();
  await expect(page.getByRole("status")).toContainText(/confirm your subscription/i);

  await signIn(page);
  await page.goto(`/admin/newsletter?q=${encodeURIComponent(email)}`);
  await expect(page.getByRole("row", { name: new RegExp(email) })).toContainText("Awaiting confirmation");
});

test("invalid newsletter tokens are rejected", async ({ page }) => {
  await page.goto("/newsletter/confirm?token=not-a-real-token");
  await expect(page.locator("h1")).toHaveText(/expired/i);
});
