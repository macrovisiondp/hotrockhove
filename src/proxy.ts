import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { buildCsp } from "@/lib/csp";

type Rule = { fromPath: string; toPath: string; statusCode: number; prefix: boolean };
type Routing = { redirects: Rule[]; maintenance: boolean; frameOrigins: string[] };

/**
 * Runs before every page render:
 *  1. Applies admin-managed redirects (301/302/410) and maintenance mode.
 *  2. Optimistically redirects signed-out visitors away from /admin. This is a UX
 *     shortcut only — every admin page, action and route re-checks the session.
 *  3. Generates a per-request nonce and sets the CSP.
 *
 * Routing data is fetched from /api/internal/routing and cached in memory for 60 s
 * per instance, so admin changes to redirects apply within a minute.
 */
const TTL_MS = 60_000;
let routingCache: { at: number; data: Routing } | null = null;

async function routing(origin: string): Promise<Routing> {
  if (routingCache && Date.now() - routingCache.at < TTL_MS) return routingCache.data;
  try {
    // Protected Vercel previews need the automation bypass secret for self-requests.
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const res = await fetch(`${origin}/api/internal/routing`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
      headers: bypass ? { "x-vercel-protection-bypass": bypass } : undefined,
    });
    if (res.ok) {
      const data = (await res.json()) as Routing;
      routingCache = { at: Date.now(), data };
      return data;
    }
  } catch {
    // Fall through: serve the request without redirects rather than failing it.
  }
  return routingCache?.data ?? { redirects: [], maintenance: false, frameOrigins: [] };
}

function norm(p: string) {
  const s = p.toLowerCase();
  return s.length > 1 ? s.replace(/\/+$/, "") : s;
}

function findRule(rules: Rule[], path: string): Rule | null {
  const p = norm(path);
  let best: Rule | null = null;
  for (const r of rules) {
    const from = norm(r.fromPath);
    if (from === p) return r;
    if (r.prefix && p.startsWith(from + "/") && (!best || from.length > norm(best.fromPath).length)) best = r;
  }
  return best;
}

const PUBLIC_ADMIN_PATHS = ["/admin/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const hasSession = Boolean(getSessionCookie(request));

  if (isAdmin && !PUBLIC_ADMIN_PATHS.includes(pathname) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const data = isAdmin ? null : await routing(request.nextUrl.origin);

  if (data) {
    const rule = findRule(data.redirects, pathname);
    if (rule) {
      if (rule.statusCode === 410) {
        return new NextResponse("This page has been removed.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" } });
      }
      // "book" is resolved by /go/book, which reads the Book Table setting.
      const target = rule.toPath === "book" ? "/go/book" : rule.toPath;
      const url = /^https:\/\//.test(target) ? new URL(target) : new URL(target, request.nextUrl.origin);
      if (url.toString() !== request.nextUrl.toString()) return NextResponse.redirect(url, rule.statusCode === 302 ? 302 : 301);
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, { isDev: process.env.NODE_ENV === "development", frameOrigins: data?.frameOrigins });
  const reportOnly = process.env.CSP_REPORT_ONLY === "true";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("Content-Security-Policy", csp);

  let response: NextResponse;
  if (data?.maintenance && !hasSession && pathname !== "/maintenance") {
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders }, status: 503 });
    response.headers.set("Retry-After", "3600");
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  response.headers.set(reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|media|brand|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
