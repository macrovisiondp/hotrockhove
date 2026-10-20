import "server-only";
import { createDb, type Db } from "./client";

// One handle per process, created on first use. Next.js bundles route handlers and
// pages separately (so a plain module singleton would open several pools or PGlite
// instances), and build workers import every route without needing a database.
const globalForDb = globalThis as unknown as { __db?: Db };

function instance(): Db {
  return (globalForDb.__db ??= createDb(process.env.DATABASE_URL));
}

export const db = new Proxy({} as Db, {
  get(_, prop) {
    const real = instance();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export * as t from "./schema";
