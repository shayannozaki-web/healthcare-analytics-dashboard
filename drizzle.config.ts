import path from "node:path";
import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "healthcare.db"),
  },
} satisfies Config;
