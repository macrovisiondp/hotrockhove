import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "../src/db/client";

async function main() {
  const url = process.env.DATABASE_URL ?? "pglite:./.data/pglite";
  const db = createDb(url);
  // Both drivers expose the same migrator contract; PGlite uses its own entry point.
  if (url.startsWith("pglite:")) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: "./drizzle" });
  } else {
    await migratePg(db, { migrationsFolder: "./drizzle" });
  }
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
