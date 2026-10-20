import { expect, type BrowserContext, type Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.DEV_ADMIN_EMAIL ?? "";
export const ADMIN_PASSWORD = process.env.DEV_ADMIN_PASSWORD ?? "";

/** Answer the cookie banner up front so it doesn't cover content. */
export async function acceptEssentialCookies(context: BrowserContext, baseURL: string) {
  await context.addCookies([{ name: "hr_consent", value: "essential", url: baseURL }]);
}

/** Mark all pop-ups as seen for this context. */
export async function suppressPopups(context: BrowserContext) {
  await context.addInitScript(() => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k: string) {
      return k.startsWith("hr_popup_") ? "1" : orig.call(this, k);
    };
  });
}

export async function signIn(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  // Reuse the shared session when the context already has one (see auth.setup.ts).
  if (email === ADMIN_EMAIL) {
    await page.goto("/admin");
    if (/\/admin$/.test(page.url())) return;
  }
  if (!email || !password) throw new Error("Set DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD in .env.local (npm run admin:create -- --dev)");
  await page.goto("/admin/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/admin$/);
}

/** Wait until admin forms are interactive (React hydrated). */
export async function waitForForms(page: Page) {
  await page.locator("form[data-hydrated]").first().waitFor();
}

/** Visible alerts, excluding Next.js's hidden route announcer (which also has role="alert"). */
export const alerts = (scope: Page | ReturnType<Page["locator"]>) => scope.locator('[role="alert"]:not(#__next-route-announcer__)');

/** Submit an admin ActionForm and wait for its status banner. */
export async function saveAndExpect(page: Page, scope: ReturnType<Page["locator"]>, text: RegExp | string, button = /save/i) {
  await scope.getByRole("button", { name: button }).first().click();
  await expect(scope.locator('[role="status"], [role="alert"]').first()).toContainText(text);
}
