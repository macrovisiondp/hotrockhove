import { NextResponse } from "next/server";
import { getBookTarget } from "@/domain/links";
import { env } from "@/lib/env";

/** Stable "Book Table" URL for redirects and print/QR use; follows the Business settings. */
export async function GET() {
  const target = await getBookTarget();
  const url = target.external || target.href.startsWith("tel:") ? target.href : new URL(target.href, env().APP_URL).toString();
  return NextResponse.redirect(url, 302);
}
