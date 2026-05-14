import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "healthcare.db");

declare global {
  // eslint-disable-next-line no-var
  var __sqlite__: Database.Database | undefined;
}

const sqlite = global.__sqlite__ ?? new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

if (process.env.NODE_ENV !== "production") {
  global.__sqlite__ = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
