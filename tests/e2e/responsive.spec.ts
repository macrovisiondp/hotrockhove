import { expect, test } from "@playwright/test";

test("mobile: centred logo, menu, quick actions, popup once per session", async ({ page }) => {
  await page.goto("/");
  // Cookie banner first; pop-ups wait for it.
  await page.getByRole("button", { name: "Essential only" }).click();

  const viewport = page.viewportSize()!;
  const logo = await page.getByRole("link", { name: "Hot Rock Hove home" }).boundingBox();
  expect(Math.abs(logo!.x + logo!.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);

  // No horizontal scrolling.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Homepage newsletter pop-up (2 s delay) appears once, closes with Escape.
  const dialog = page.getByRole("dialog", { name: /premier wagyu/i });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.waitForTimeout(3500);
  await expect(dialog).toBeHidden();

  // Mobile menu opens, lists pages, closes.
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu.getByRole("link", { name: "Our Menu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  // Quick actions bar.
  const actions = page.getByRole("navigation", { name: "Quick actions" });
  await expect(actions.getByRole("link", { name: /call/i })).toHaveAttribute("href", /^tel:/);
  await expect(actions.getByRole("link", { name: /menu/i })).toHaveAttribute("href", "/our-menus");
});
