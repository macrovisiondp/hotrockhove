/**
 * Visual QA: full-page screenshots of key pages at mobile, tablet and desktop widths.
 *
 *   BASE_URL=http://localhost:3100 npx tsx scripts/screens.ts [/path …]
 *
 * Output: .data/screens/<width>-<page>.png (git-ignored). Accepts the cookie banner
 * as "essential" first so it doesn't cover content, and suppresses pop-ups.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/our-menus", "/daisy", "/wagyu", "/gallery", "/contact"];
const widths = (process.env.WIDTHS ?? "390,1440").split(",").map(Number);

async function main() {
  mkdirSync(".data/screens", { recursive: true });
  const browser = await chromium.launch();
  for (const width of widths) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    await ctx.addCookies([{ name: "hr_consent", value: "essential", url: BASE }]);
    // Mark every pop-up as already seen this session.
    await ctx.addInitScript(() => {
      const orig = Storage.prototype.getItem;
      Storage.prototype.getItem = function (k: string) {
        return k.startsWith("hr_popup_") ? "1" : orig.call(this, k);
      };
    });
    const page = await ctx.newPage();
    for (const p of paths) {
      await page.goto(BASE + p, { waitUntil: "load", timeout: 90_000 });
      // Dev servers sometimes reload once after compiling; settle before measuring.
      await page.waitForTimeout(1500);
      await page.waitForLoadState("load");
      // Trigger lazy images by scrolling through the page.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
        await Promise.all(
          [...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 8000); }))),
        );
      });
      await page.waitForTimeout(400);
      const name = p === "/" ? "home" : p.replace(/\//g, "_").replace(/^_/, "");
      await page.screenshot({ path: `.data/screens/${width}-${name}.png`, fullPage: true });
      console.log(`${width} ${p}`);
    }
    await ctx.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
