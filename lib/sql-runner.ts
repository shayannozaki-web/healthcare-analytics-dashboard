import Database from "better-sqlite3";
import path from "node:path";

import { validateSelect } from "./sql-guard";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "healthcare.db");
const MAX_ROWS = 1000;

declare global {
  // eslint-disable-next-line no-var
  var __sqlite_readonly__: Database.Database | undefined;
}

function getReadOnlyDb(): Database.Database {
  if (global.__sqlite_readonly__) return global.__sqlite_readonly__;
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  db.pragma("query_only = ON");
  db.pragma("busy_timeout = 5000");
  if (process.env.NODE_ENV !== "production") {
    global.__sqlite_readonly__ = db;
  }
  return db;
}

export type SqlResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  truncated: boolean;
};

export function runSelect(sql: string): SqlResult {
  const guard = validateSelect(sql);
  if (!guard.ok) throw new Error(guard.reason);

  const db = getReadOnlyDb();
  const stmt = db.prepare(guard.sql);
  // Some statements (e.g. PRAGMA-equivalents we already block) don't return rows; SELECTs do.
  const rows = stmt.all() as Array<Record<string, unknown>>;
  const truncated = rows.length > MAX_ROWS;
  const limited = truncated ? rows.slice(0, MAX_ROWS) : rows;
  const columns =
    limited.length > 0
      ? Object.keys(limited[0])
      : (stmt.columns().map((c) => c.name) ?? []);
  return { columns, rows: limited, truncated };
}
