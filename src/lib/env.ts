import "server-only";
import { z } from "zod";

/**
 * Server environment: platform infrastructure only. Business details, recipients,
 * branding and the owner's own provider keys (Resend, Cloudinary) are managed in
 * the admin and stored in the `settings` table (secrets encrypted).
 */
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Postgres/Neon connection string. `pglite:<dir>` runs an embedded Postgres for local development. */
  DATABASE_URL: z.string().min(1).default("pglite:./.data/pglite"),
  /** Canonical public origin, e.g. https://hotrockhove.com — used for canonical URLs, sitemap and email links. */
  APP_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32),
  /** 32-byte key (base64 or hex) for encrypting admin-managed credentials at rest. */
  SETTINGS_ENCRYPTION_KEY: z.string().min(32),
  /** Optional fallback used only when no Resend key has been saved in Admin → Email. */
  RESEND_API_KEY: optional,
  /** Cloudflare Turnstile. When unset, forms rely on the honeypot and rate limits, and the dashboard warns. */
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional,
  TURNSTILE_SECRET_KEY: optional,
  /** Shared secret for Vercel Cron requests (retention purge). */
  CRON_SECRET: optional,
  /** Optional custom media domain (CloudFront alias), e.g. media.hotrockhove.com. Read at build time for image optimisation and CSP. */
  MEDIA_PUBLIC_HOST: optional,
  /** Allows the local-disk media adapter (development only; refused on Vercel). */
  ALLOW_LOCAL_STORAGE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof schema>;

/**
 * Public origin of this deployment: APP_URL when set, otherwise derived from
 * Vercel's system variables (production domain, branch alias, or deployment URL).
 */
export function resolveAppUrl(e: Record<string, string | undefined> = process.env): string {
  const explicit = e.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (e.VERCEL_ENV === "production" && e.VERCEL_PROJECT_PRODUCTION_URL) return `https://${e.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (e.VERCEL_BRANCH_URL) return `https://${e.VERCEL_BRANCH_URL}`;
  if (e.VERCEL_URL) return `https://${e.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Every origin this deployment answers on (for sign-in origin checks). */
export function deploymentOrigins(e: Record<string, string | undefined> = process.env): string[] {
  const hosts = [e.VERCEL_URL, e.VERCEL_BRANCH_URL, e.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean).map((h) => `https://${h}`);
  return [...new Set([resolveAppUrl(e), ...hosts])];
}

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse({ ...process.env, APP_URL: resolveAppUrl() });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${fields}`);
  }
  if (process.env.VERCEL && parsed.data.ALLOW_LOCAL_STORAGE) {
    throw new Error("ALLOW_LOCAL_STORAGE must not be enabled on Vercel");
  }
  cached = parsed.data;
  return cached;
}

export function turnstileConfigured(): boolean {
  const e = env();
  return Boolean(e.NEXT_PUBLIC_TURNSTILE_SITE_KEY && e.TURNSTILE_SECRET_KEY);
}
