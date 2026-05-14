import type { SqlResult } from "./sql-runner";

export type ChartShape =
  | { kind: "line"; xKey: string; yKeys: string[] }
  | { kind: "bar"; xKey: string; yKey: string }
  | { kind: "none" };

const NUMERIC_TYPES = new Set(["number", "bigint"]);
const DATE_LIKE_RE = /^\d{4}(-\d{2})?(-\d{2})?/;

function isNumericColumn(rows: SqlResult["rows"], col: string): boolean {
  for (const row of rows) {
    const v = row[col];
    if (v == null) continue;
    if (!NUMERIC_TYPES.has(typeof v)) return false;
  }
  return rows.some((r) => r[col] != null);
}

function isDateLikeColumn(rows: SqlResult["rows"], col: string): boolean {
  let hits = 0;
  for (const row of rows) {
    const v = row[col];
    if (v == null) continue;
    if (typeof v === "string" && DATE_LIKE_RE.test(v)) hits++;
    else return false;
  }
  return hits >= 2;
}

/**
 * Decide if a result set has a shape worth charting. The LLM also returns a
 * `result_type`/`chart_type` hint, but we only trust it if the actual data
 * matches — otherwise we fall back to the table.
 */
export function detectChartShape(result: SqlResult, hint: "line" | "bar" | null): ChartShape {
  const { columns, rows } = result;
  if (rows.length < 2) return { kind: "none" };
  if (columns.length < 2) return { kind: "none" };
  if (rows.length > 50 && hint !== "line") return { kind: "none" };

  const numericCols = columns.filter((c) => isNumericColumn(rows, c));
  const categoryCols = columns.filter((c) => !numericCols.includes(c));

  // Line chart: first column is date-like or month-like, all other columns numeric.
  const dateCol = columns.find((c) => isDateLikeColumn(rows, c));
  if (hint !== "bar" && dateCol && numericCols.length >= 1 && rows.length <= 240) {
    return { kind: "line", xKey: dateCol, yKeys: numericCols.filter((c) => c !== dateCol) };
  }

  // Bar chart: one categorical, one numeric.
  if (categoryCols.length >= 1 && numericCols.length === 1 && rows.length <= 30) {
    return { kind: "bar", xKey: categoryCols[0], yKey: numericCols[0] };
  }

  return { kind: "none" };
}
