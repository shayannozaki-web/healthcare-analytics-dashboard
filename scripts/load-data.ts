import { execSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import Database from "better-sqlite3";
import { parse } from "csv-parse";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const SYNTHEA_DIR = path.join(DATA_DIR, "synthea");
const ZIP_PATH = path.join(SYNTHEA_DIR, "sample.zip");
const CSV_DIR = path.join(SYNTHEA_DIR, "csv");
const DB_PATH = process.env.DATABASE_PATH ?? path.join(DATA_DIR, "healthcare.db");
const MIGRATIONS_DIR = path.join(ROOT, "db", "migrations");

const SAMPLE_URL =
  "https://raw.githubusercontent.com/synthetichealth/synthea-sample-data/main/downloads/synthea_sample_data_csv_nov2021.zip";

async function downloadSampleData() {
  mkdirSync(SYNTHEA_DIR, { recursive: true });
  if (existsSync(ZIP_PATH) && statSync(ZIP_PATH).size > 1_000_000) {
    console.log(`✓ sample.zip already present (${(statSync(ZIP_PATH).size / 1e6).toFixed(1)} MB)`);
  } else {
    console.log(`↓ downloading Synthea sample CSV bundle (~57 MB)…`);
    const res = await fetch(SAMPLE_URL);
    if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(ZIP_PATH, buf);
    console.log(`✓ downloaded ${(buf.length / 1e6).toFixed(1)} MB`);
  }

  if (!existsSync(path.join(CSV_DIR, "patients.csv"))) {
    console.log(`↳ unzipping…`);
    execSync(`unzip -q -o "${ZIP_PATH}" -d "${SYNTHEA_DIR}"`);
    console.log(`✓ unzipped`);
  } else {
    console.log(`✓ csv/ already extracted`);
  }
}

function applyMigrations(sqlite: Database.Database) {
  const fs = require("node:fs") as typeof import("node:fs");
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) sqlite.exec(stmt);
  }
  console.log(`✓ schema applied (${files.length} migration${files.length === 1 ? "" : "s"})`);
}

async function streamCsv(
  filePath: string,
  onRow: (row: Record<string, string>) => void,
) {
  const parser = parse({ columns: true, trim: true, skip_empty_lines: true });
  let count = 0;
  parser.on("data", (row: Record<string, string>) => {
    onRow(row);
    count++;
  });
  await pipeline(createReadStream(filePath), parser);
  return count;
}

const nullable = (v: string | undefined) => (v && v.length > 0 ? v : null);
const numeric = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function loadCsvs(sqlite: Database.Database) {
  // Patients
  {
    const stmt = sqlite.prepare(
      `INSERT INTO patients (id, first_name, last_name, dob, gender, race, ethnicity, marital_status, address_zip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
    );
    const tx = sqlite.transaction((rows: Record<string, string>[]) => {
      for (const r of rows) {
        stmt.run(
          r.Id,
          r.FIRST,
          r.LAST,
          r.BIRTHDATE,
          nullable(r.GENDER),
          nullable(r.RACE),
          nullable(r.ETHNICITY),
          nullable(r.MARITAL),
          nullable(r.ZIP),
        );
      }
    });
    const batch: Record<string, string>[] = [];
    const count = await streamCsv(path.join(CSV_DIR, "patients.csv"), (row) => {
      batch.push(row);
      if (batch.length >= 5000) {
        tx(batch.splice(0));
      }
    });
    if (batch.length) tx(batch);
    console.log(`✓ patients: ${count}`);
  }

  // Encounters
  {
    const stmt = sqlite.prepare(
      `INSERT INTO encounters (id, patient_id, start_date, end_date, encounter_class, reason_description, total_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
    );
    const tx = sqlite.transaction((rows: Record<string, string>[]) => {
      for (const r of rows) {
        stmt.run(
          r.Id,
          r.PATIENT,
          r.START,
          nullable(r.STOP),
          nullable(r.ENCOUNTERCLASS),
          nullable(r.REASONDESCRIPTION) ?? nullable(r.DESCRIPTION),
          numeric(r.TOTAL_CLAIM_COST),
        );
      }
    });
    const batch: Record<string, string>[] = [];
    const count = await streamCsv(path.join(CSV_DIR, "encounters.csv"), (row) => {
      batch.push(row);
      if (batch.length >= 5000) tx(batch.splice(0));
    });
    if (batch.length) tx(batch);
    console.log(`✓ encounters: ${count}`);
  }

  // Conditions (no Id in Synthea CSV — synthesize)
  {
    const stmt = sqlite.prepare(
      `INSERT INTO conditions (id, patient_id, onset_date, resolution_date, code, description)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
    );
    const tx = sqlite.transaction((rows: Record<string, string>[]) => {
      for (const r of rows) {
        const id = `${r.PATIENT}|${r.CODE}|${r.START}`;
        stmt.run(id, r.PATIENT, r.START, nullable(r.STOP), nullable(r.CODE), nullable(r.DESCRIPTION));
      }
    });
    const batch: Record<string, string>[] = [];
    const count = await streamCsv(path.join(CSV_DIR, "conditions.csv"), (row) => {
      batch.push(row);
      if (batch.length >= 5000) tx(batch.splice(0));
    });
    if (batch.length) tx(batch);
    console.log(`✓ conditions: ${count}`);
  }

  // Medications (Synthea has refills with the same patient/code/start — sequence to keep them all)
  {
    const stmt = sqlite.prepare(
      `INSERT INTO medications (id, patient_id, start_date, stop_date, code, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const seen = new Map<string, number>();
    const tx = sqlite.transaction((rows: Record<string, string>[]) => {
      for (const r of rows) {
        const base = `${r.PATIENT}|${r.CODE}|${r.START}`;
        const seq = (seen.get(base) ?? 0) + 1;
        seen.set(base, seq);
        const id = seq === 1 ? base : `${base}|${seq}`;
        stmt.run(id, r.PATIENT, r.START, nullable(r.STOP), nullable(r.CODE), nullable(r.DESCRIPTION));
      }
    });
    const batch: Record<string, string>[] = [];
    const count = await streamCsv(path.join(CSV_DIR, "medications.csv"), (row) => {
      batch.push(row);
      if (batch.length >= 5000) tx(batch.splice(0));
    });
    if (batch.length) tx(batch);
    console.log(`✓ medications: ${count}`);
  }

  // Observations (sequence per patient/code/date so duplicate dates don't collide)
  {
    const stmt = sqlite.prepare(
      `INSERT INTO observations (id, patient_id, date, code, description, value, units)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
    );
    const seen = new Map<string, number>();
    const tx = sqlite.transaction((rows: Record<string, string>[]) => {
      for (const r of rows) {
        const base = `${r.PATIENT}|${r.CODE}|${r.DATE}`;
        const seq = (seen.get(base) ?? 0) + 1;
        seen.set(base, seq);
        const id = seq === 1 ? base : `${base}|${seq}`;
        stmt.run(id, r.PATIENT, r.DATE, nullable(r.CODE), nullable(r.DESCRIPTION), nullable(r.VALUE), nullable(r.UNITS));
      }
    });
    const batch: Record<string, string>[] = [];
    const count = await streamCsv(path.join(CSV_DIR, "observations.csv"), (row) => {
      batch.push(row);
      if (batch.length >= 10000) tx(batch.splice(0));
    });
    if (batch.length) tx(batch);
    console.log(`✓ observations: ${count}`);
  }
}

function sanityCheck(sqlite: Database.Database) {
  const counts = sqlite
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM patients) AS patients,
         (SELECT COUNT(*) FROM encounters) AS encounters,
         (SELECT COUNT(*) FROM conditions) AS conditions,
         (SELECT COUNT(*) FROM medications) AS medications,
         (SELECT COUNT(*) FROM observations) AS observations`,
    )
    .get() as Record<string, number>;
  console.log(`\nrow counts: ${JSON.stringify(counts)}`);

  const sample = sqlite
    .prepare(
      `SELECT description, COUNT(DISTINCT patient_id) AS patient_count
       FROM conditions
       WHERE description IS NOT NULL
       GROUP BY description
       ORDER BY patient_count DESC
       LIMIT 5`,
    )
    .all();
  console.log(`top 5 conditions by patient count:`);
  for (const row of sample as Array<{ description: string; patient_count: number }>) {
    console.log(`  ${row.patient_count.toString().padStart(4)}  ${row.description}`);
  }
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  await downloadSampleData();

  const fresh = process.argv.includes("--fresh");
  if (fresh && existsSync(DB_PATH)) {
    require("node:fs").rmSync(DB_PATH);
    console.log(`✓ removed existing ${DB_PATH}`);
  }

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = OFF"); // load order tolerant
  sqlite.pragma("synchronous = NORMAL");
  try {
    applyMigrations(sqlite);
    await loadCsvs(sqlite);
    sanityCheck(sqlite);
  } finally {
    sqlite.close();
  }
  console.log(`\n✓ done. database: ${DB_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
