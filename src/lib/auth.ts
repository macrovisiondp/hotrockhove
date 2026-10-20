import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, t } from "@/db";

/**
 * Staff authentication (Better Auth, email + password, database sessions).
 * Public sign-up is disabled: accounts are created by an owner in Admin → Users
 * or with `npm run admin:create`.
 */
export const auth = betterAuth({
  appName: "Hot Rock Hove",
  baseURL: process.env.APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: t.users, session: t.sessions, account: t.accounts, verification: t.verifications },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "viewer" },
      active: { type: "boolean", input: false, defaultValue: true },
    },
  },
  session: {
    expiresIn: 60 * 60 * 12, // 12 hours
    updateAge: 60 * 60,
  },
  rateLimit: { enabled: true, window: 60, max: 20 },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    database: { generateId: () => crypto.randomUUID() },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, session.userId) });
          if (!user || !user.active) return false;
          return { data: session };
        },
      },
    },
  },
  plugins: [nextCookies()],
});
