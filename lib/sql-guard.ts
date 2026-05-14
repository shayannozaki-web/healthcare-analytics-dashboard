// Application-layer guard. Defense-in-depth pairs with opening the database in
// readonly mode and using parameterized prepared statements with no user-supplied
// parameters bound at execution time.

const FORBIDDEN_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "CREATE",
  "REPLACE",
  "TRUNCATE",
  "ATTACH",
  "DETACH",
  "PRAGMA",
  "VACUUM",
  "REINDEX",
  "ANALYZE",
  "GRANT",
  "REVOKE",
  "MERGE",
] as const;

export type SqlGuardResult =
  | { ok: true; sql: string }
  | { ok: false; reason: string };

function stripComments(sql: string): string {
  // Remove block comments first, then line comments.
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

export function validateSelect(input: string): SqlGuardResult {
  if (typeof input !== "string") return { ok: false, reason: "SQL must be a string." };

  const stripped = stripComments(input).trim();
  if (!stripped) return { ok: false, reason: "Empty SQL." };

  // Allow at most one trailing semicolon.
  const noTrailing = stripped.replace(/;+\s*$/, "").trim();
  if (noTrailing.includes(";")) {
    return { ok: false, reason: "Multiple SQL statements are not allowed." };
  }

  const leading = noTrailing.match(/^\s*([A-Za-z]+)/);
  if (!leading) return { ok: false, reason: "Could not identify SQL statement." };
  const verb = leading[1].toUpperCase();
  if (verb !== "SELECT" && verb !== "WITH") {
    return {
      ok: false,
      reason: `Only SELECT (or WITH ... SELECT) statements are allowed. Got: ${verb}`,
    };
  }

  // Word-boundary keyword scan over the comment-stripped SQL.
  const upper = noTrailing.toUpperCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(upper)) {
      return { ok: false, reason: `Forbidden keyword: ${kw}` };
    }
  }

  return { ok: true, sql: noTrailing };
}
