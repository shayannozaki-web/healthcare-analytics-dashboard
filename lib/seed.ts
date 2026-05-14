import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createGunzip } from "node:zlib";

import { client } from "@/db/client";

type Column = string;

type TableSpec = {
  name: string;
  columns: Column[];
  file: string;
};

const SPECS: TableSpec[] = [
  {
    name: "patients",
    columns: ["id", "first_name", "last_name", "dob", "gender", "race", "ethnicity", "marital_status", "address_zip"],
    file: "patients.jsonl.gz",
  },
  {
    name: "encounters",
    columns: ["id", "patient_id", "start_date", "end_date", "encounter_class", "reason_description", "total_cost"],
    file: "encounters.jsonl.gz",
  },
  {
    name: "conditions",
    columns: ["id", "patient_id", "onset_date", "resolution_date", "code", "description"],
    file: "conditions.jsonl.gz",
  },
  {
    name: "medications",
    columns: ["id", "patient_id", "start_date", "stop_date", "code", "description"],
    file: "medications.jsonl.gz",
  },
];

// Approximate row counts in the seed bundle — used for the UI progress bar so the
// user has a sense of remaining work before the gzip stream tells us the real
// total. Within ~1% of the real counts.
export const EXPECTED_COUNTS: Record<string, number> = {
  patients: 1163,
  encounters: 61459,
  conditions: 38094,
  medications: 56430,
};

const BATCH_SIZE = 100; // 100 rows × up to 9 cols = 900 params, well under libSQL limits.

export type SeedProgress =
  | { kind: "schema"; message: string }
  | { kind: "table"; table: string; inserted: number; total: number }
  | { kind: "table_done"; table: string; inserted: number }
  | { kind: "done"; counts: Record<string, number> };

export async function isSeeded(): Promise<boolean> {
  try {
    const r = await client.execute("SELECT COUNT(*) AS n FROM patients");
    const n = r.rows[0]?.n;
    return typeof n === "number" && n > 0;
  } catch {
    // Tables don't exist yet, or the connection is otherwise broken; treat as not seeded.
    return false;
  }
}

export async function rowCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const spec of SPECS) {
    try {
      const r = await client.execute(`SELECT COUNT(*) AS n FROM ${spec.name}`);
      counts[spec.name] = typeof r.rows[0]?.n === "number" ? (r.rows[0].n as number) : 0;
    } catch {
      counts[spec.name] = 0;
    }
  }
  return counts;
}

async function applySchema(emit: (p: SeedProgress) => void) {
  const migrationPath = path.join(process.cwd(), "db", "migrations", "0000_init.sql");
  const sql = await readFile(migrationPath, "utf8");

  // Drizzle's generated SQL uses bare CREATE TABLE/INDEX. Make them idempotent.
  const idempotent = sql
    .replace(/CREATE TABLE\b/gi, "CREATE TABLE IF NOT EXISTS")
    .replace(/CREATE INDEX\b/gi, "CREATE INDEX IF NOT EXISTS")
    .replace(/CREATE UNIQUE INDEX\b/gi, "CREATE UNIQUE INDEX IF NOT EXISTS");

  const statements = idempotent
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  emit({ kind: "schema", message: `Applying schema (${statements.length} statements)…` });
  await client.batch(statements, "write");
  emit({ kind: "schema", message: "Schema ready." });
}

async function loadTable(
  spec: TableSpec,
  emit: (p: SeedProgress) => void,
): Promise<number> {
  const seedPath = path.join(process.cwd(), "seed", spec.file);
  const stream = createReadStream(seedPath).pipe(createGunzip());

  const expected = EXPECTED_COUNTS[spec.name] ?? 0;
  const placeholders = `(${spec.columns.map(() => "?").join(", ")})`;
  const insertHead = `INSERT INTO ${spec.name} (${spec.columns.join(", ")}) VALUES `;

  let inserted = 0;
  let buffer: unknown[][] = [];
  let pending = "";

  const flush = async () => {
    if (buffer.length === 0) return;
    const valuesSql = Array(buffer.length).fill(placeholders).join(", ");
    const sql = `${insertHead}${valuesSql} ON CONFLICT(id) DO NOTHING`;
    const args = buffer.flat() as Array<string | number | null>;
    await client.execute({ sql, args });
    inserted += buffer.length;
    buffer = [];
    emit({ kind: "table", table: spec.name, inserted, total: expected });
  };

  // Read the gunzip stream, split on newlines, parse each line as a JSON array.
  for await (const chunk of stream) {
    pending += chunk.toString("utf8");
    let nl: number;
    while ((nl = pending.indexOf("\n")) !== -1) {
      const line = pending.slice(0, nl).trim();
      pending = pending.slice(nl + 1);
      if (!line) continue;
      buffer.push(JSON.parse(line) as unknown[]);
      if (buffer.length >= BATCH_SIZE) await flush();
    }
  }
  if (pending.trim()) {
    buffer.push(JSON.parse(pending.trim()) as unknown[]);
  }
  await flush();

  emit({ kind: "table_done", table: spec.name, inserted });
  return inserted;
}

export async function seed(emit: (p: SeedProgress) => void): Promise<Record<string, number>> {
  await applySchema(emit);
  const counts: Record<string, number> = {};
  for (const spec of SPECS) {
    counts[spec.name] = await loadTable(spec, emit);
  }
  emit({ kind: "done", counts });
  return counts;
}
