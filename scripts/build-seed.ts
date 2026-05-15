// Pre-processes the Synthea CSVs we already downloaded under data/synthea/csv into
// compact gzipped JSONL arrays committed to the repo (under seed/). The runtime
// /api/seed endpoint streams these into Turso on the user's first deploy.
//
// We deliberately skip observations.csv — it's half a million rows and 92 MB raw.
// None of the spec sample queries or dashboard pages touch observations.

import { createReadStream, createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

import { parse } from "csv-parse";

const ROOT = process.cwd();
const CSV_DIR = path.join(ROOT, "data", "synthea", "csv");
const OUT_DIR = path.join(ROOT, "seed");

mkdirSync(OUT_DIR, { recursive: true });

const nullify = (v: string | undefined) => (v && v.length > 0 ? v : null);

type Spec = {
  file: string;
  out: string;
  map: (row: Record<string, string>, seq: Map<string, number>) => unknown[];
};

const SPECS: Spec[] = [
  {
    file: "patients.csv",
    out: "patients.jsonl.gz",
    map: (r) => [
      r.Id,
      r.FIRST,
      r.LAST,
      r.BIRTHDATE,
      nullify(r.GENDER),
      nullify(r.RACE),
      nullify(r.ETHNICITY),
      nullify(r.MARITAL),
      nullify(r.ZIP),
    ],
  },
  {
    file: "encounters.csv",
    out: "encounters.jsonl.gz",
    map: (r) => [
      r.Id,
      r.PATIENT,
      r.START,
      nullify(r.STOP),
      nullify(r.ENCOUNTERCLASS),
      nullify(r.REASONDESCRIPTION) ?? nullify(r.DESCRIPTION),
      r.TOTAL_CLAIM_COST ? Number(r.TOTAL_CLAIM_COST) : null,
    ],
  },
  {
    file: "conditions.csv",
    out: "conditions.jsonl.gz",
    map: (r) => [
      `${r.PATIENT}|${r.CODE}|${r.START}`,
      r.PATIENT,
      r.START,
      nullify(r.STOP),
      nullify(r.CODE),
      nullify(r.DESCRIPTION),
    ],
  },
  {
    file: "medications.csv",
    out: "medications.jsonl.gz",
    map: (r, seen) => {
      const base = `${r.PATIENT}|${r.CODE}|${r.START}`;
      const seq = (seen.get(base) ?? 0) + 1;
      seen.set(base, seq);
      const id = seq === 1 ? base : `${base}|${seq}`;
      return [id, r.PATIENT, r.START, nullify(r.STOP), nullify(r.CODE), nullify(r.DESCRIPTION)];
    },
  },
];

async function processSpec(spec: Spec) {
  const inputPath = path.join(CSV_DIR, spec.file);
  const outputPath = path.join(OUT_DIR, spec.out);

  const gzip = createGzip({ level: 9 });
  const output = createWriteStream(outputPath);
  gzip.pipe(output);

  const parser = parse({ columns: true, trim: true, skip_empty_lines: true });
  let count = 0;
  const seen = new Map<string, number>();

  parser.on("data", (row: Record<string, string>) => {
    const arr = spec.map(row, seen);
    gzip.write(JSON.stringify(arr) + "\n");
    count++;
  });

  await pipeline(createReadStream(inputPath), parser);
  gzip.end();
  await new Promise<void>((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
  });

  console.log(`✓ ${spec.file.padEnd(20)} → seed/${spec.out} (${count.toLocaleString()} rows)`);
}

async function main() {
  for (const spec of SPECS) {
    await processSpec(spec);
  }
  console.log("\n✓ seed bundle written to seed/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
