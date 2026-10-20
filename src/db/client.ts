import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

const DEFAULT_URL = "pglite:./.data/pglite";

/**
 * `pglite:<dir>` → embedded Postgres (local development only, single process).
 * Anything else → a real Postgres/Neon connection string.
 */
export function createDb(url: string = DEFAULT_URL): Db {
  if (url.startsWith("pglite:")) {
    if (process.env.VERCEL) {
      throw new Error("PGlite is for local development only; set DATABASE_URL to Postgres/Neon.");
    }
    // Loaded lazily so production bundles never touch the WASM build.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mkdirSync } = require("node:fs") as typeof import("node:fs");
    const dir = url.slice("pglite:".length);
    mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    // Same query builder at runtime; the postgres-js type is used as the common surface.
    return drizzle({ client, schema }) as unknown as Db;
  }

  const client = postgres(url, {
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    prepare: false, // compatible with Neon's pooled (PgBouncer) endpoint
  });
  return drizzlePostgres({ client, schema });
}
