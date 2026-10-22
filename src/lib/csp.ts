/**
 * Content Security Policy — the single place where allowed sources are defined.
 *
 * Third-party origins:
 *  - challenges.cloudflare.com — Turnstile (script, iframe, verification calls).
 *  - *.amazonaws.com / *.cloudfront.net (+ MEDIA_PUBLIC_HOST) — site media on S3,
 *    and presigned browser uploads to S3 from the admin.
 *  - res.cloudinary.com — alternative media provider.
 *  - cdn.trustindex.io (+ its image/style hosts) — Google reviews widget, only
 *    injected after the visitor accepts optional cookies.
 *  - Optional 360° tour host, only while that feature is switched on.
 *  - www.google.com / maps.google.com — the "Visit us" map embed (frame only; it
 *    loads after cookie consent or a click).
 *
 * Documented exceptions:
 *  - style-src-attr 'unsafe-inline': Turnstile and the reviews widget size
 *    elements with inline style attributes. <style> elements still need the nonce.
 *  - 'unsafe-eval' in development only (React dev tooling).
 */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
export const CLOUDINARY_ORIGIN = "https://res.cloudinary.com";
/** S3 buckets (eu-west-2 virtual-hosted URLs and presigned uploads) and CloudFront distributions. */
export const S3_ORIGINS = ["https://*.amazonaws.com", "https://*.cloudfront.net"];
/** Optional custom media domain (e.g. a CloudFront alias like media.hotrockhove.com). */
const MEDIA_HOST = [
  ...(process.env.MEDIA_PUBLIC_HOST ? [`https://${process.env.MEDIA_PUBLIC_HOST}`] : []),
  // Neon Object Storage endpoint (public reads + presigned browser uploads).
  ...(process.env.AWS_ENDPOINT_URL_S3 ? [new URL(process.env.AWS_ENDPOINT_URL_S3).origin] : []),
];
export const TRUSTINDEX_ORIGINS = ["https://cdn.trustindex.io", "https://*.trustindex.io"];
export const GOOGLE_MAPS_FRAME_ORIGINS = ["https://www.google.com", "https://maps.google.com"];

export function buildCsp(nonce: string, opts: { isDev: boolean; frameOrigins?: string[] }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", TURNSTILE_ORIGIN, ...(opts.isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", `'nonce-${nonce}'`, ...TRUSTINDEX_ORIGINS],
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...S3_ORIGINS, ...MEDIA_HOST, CLOUDINARY_ORIGIN, ...TRUSTINDEX_ORIGINS, "https://lh3.googleusercontent.com"],
    "media-src": ["'self'", "blob:", ...S3_ORIGINS, ...MEDIA_HOST, CLOUDINARY_ORIGIN],
    "font-src": ["'self'", ...TRUSTINDEX_ORIGINS],
    "connect-src": ["'self'", TURNSTILE_ORIGIN, ...S3_ORIGINS, ...MEDIA_HOST, "https://api.cloudinary.com", ...TRUSTINDEX_ORIGINS],
    "frame-src": [TURNSTILE_ORIGIN, ...GOOGLE_MAPS_FRAME_ORIGINS, ...(opts.frameOrigins ?? [])],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!opts.isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
