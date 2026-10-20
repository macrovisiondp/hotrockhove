import { test as setup } from "@playwright/test";
import { signIn } from "./helpers";

export const AUTH_FILE = ".data/e2e-auth.json";

/** Sign in once and share the session, so the suite stays under the sign-in rate limit. */
setup("sign in as the local owner", async ({ page }) => {
  await signIn(page);
  await page.context().storageState({ path: AUTH_FILE });
});
