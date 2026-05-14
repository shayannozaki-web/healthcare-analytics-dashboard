import { client } from "@/db/client";

import { validateSelect } from "./sql-guard";

const MAX_ROWS = 1000;

export type SqlResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  truncated: boolean;
};

export async function runSelect(sql: string): Promise<SqlResult> {
  const guard = validateSelect(sql);
  if (!guard.ok) throw new Error(guard.reason);

  const result = await client.execute(guard.sql);
  const truncated = result.rows.length > MAX_ROWS;
  const limited = truncated ? result.rows.slice(0, MAX_ROWS) : result.rows;
  const rows = limited.map((r) =>
    Object.fromEntries(result.columns.map((c) => [c, r[c]])),
  );
  return { columns: result.columns, rows, truncated };
}
