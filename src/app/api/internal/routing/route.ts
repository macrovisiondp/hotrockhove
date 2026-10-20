import { NextResponse } from "next/server";
import { getRedirects } from "@/domain/content";
import { getSetting } from "@/lib/settings";

/**
 * Routing data for src/proxy.ts: redirects, maintenance flag and extra frame
 * origins for the CSP. Contains nothing private (redirects are observable by
 * anyone who requests the old URLs), so it needs no authentication.
 */
export async function GET() {
  const [rules, features] = await Promise.all([getRedirects(), getSetting("features")]);
  let frameOrigins: string[] = [];
  if (features.vrTourEnabled && features.vrTourUrl) {
    try {
      frameOrigins = [new URL(features.vrTourUrl).origin];
    } catch {
      /* invalid URL is rejected by settings validation */
    }
  }
  return NextResponse.json(
    { redirects: rules, maintenance: features.maintenanceMode, frameOrigins },
    { headers: { "Cache-Control": "no-store" } },
  );
}
