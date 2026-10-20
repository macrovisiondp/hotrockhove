import { defineConfig } from "drizzle-kit";

// Used for `db:generate` (schema → SQL migrations). Migrations are applied by scripts/migrate.ts,
// which works against both Neon/Postgres and the local PGlite database.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  strict: true,
});
