import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/** Static security headers for every response (the CSP itself is set per request in src/proxy.ts). */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()",
  },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // src/proxy.ts handles trailing slashes so old WordPress URLs (/page/) reach
  // their final destination in a single 301 instead of a 308 + 301 chain.
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Image uploads through server actions (Vercel caps request bodies at ~4.5 MB).
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  images: {
    // S3 (virtual-hosted URLs), CloudFront, Cloudinary, plus an optional custom media domain.
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      ...(process.env.MEDIA_PUBLIC_HOST ? [{ protocol: "https" as const, hostname: process.env.MEDIA_PUBLIC_HOST }] : []),
      // Neon Object Storage endpoint (public_read bucket), injected by Neon.
      ...(process.env.AWS_ENDPOINT_URL_S3 ? [{ protocol: "https" as const, hostname: new URL(process.env.AWS_ENDPOINT_URL_S3).hostname }] : []),
    ],
    localPatterns: [{ pathname: "/brand/**" }, { pathname: "/media/**" }],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
