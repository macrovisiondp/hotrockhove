import { emailFromUnsubscribeToken, unsubscribeEmail } from "@/domain/marketing";

/**
 * One-click unsubscribe (RFC 8058): mail apps POST "List-Unsubscribe=One-Click"
 * to the List-Unsubscribe URL. The token in the query identifies the address.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const email = emailFromUnsubscribeToken(token);
  if (!email) return new Response("Invalid link", { status: 400 });
  await unsubscribeEmail(email);
  return new Response("Unsubscribed", { status: 200 });
}

/** Opened in a browser: show the normal unsubscribe page (which asks for a button press). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return Response.redirect(new URL(`/unsubscribe?t=${encodeURIComponent(url.searchParams.get("t") ?? "")}`, url.origin), 303);
}
