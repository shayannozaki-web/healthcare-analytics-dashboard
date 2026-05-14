# Healthcare Analytics Dashboard

Internal-style analytics dashboard for healthcare operations: patient population, key metrics, and a natural-language query layer (text-to-SQL) over a synthetic patient database. Portfolio project mirroring the architecture of a real healthcare analytics tool.

> **Synthetic data only.** Built on [Synthea](https://github.com/synthetichealth/synthea)-generated data so there is zero PHI exposure. The architecture is designed to extend to real PHI with proper compliance layers (encryption at rest, audit logging, access controls) added.

## Stack

- Next.js (App Router) + TypeScript
- shadcn/ui + Tailwind CSS
- SQLite via better-sqlite3, schema managed by Drizzle ORM
- Recharts for visualizations
- Anthropic SDK (Claude) for the natural-language query layer

## Run locally

Requires Node 20+ and a Unix `unzip` on PATH.

```bash
npm install
cp .env.example .env.local        # add your ANTHROPIC_API_KEY
npm run db:reset                  # downloads ~57 MB Synthea sample, loads ~1k patients
npm run dev
```

The loader caches the downloaded zip and extracted CSVs under `data/` so re-runs are fast. `db:reset` rebuilds the SQLite file from scratch; `db:load` loads into an existing DB.

## Project layout

```
app/                Next.js pages (Dashboard, Patients, Ask)
components/         UI primitives + sidebar
db/                 Drizzle schema, client, generated migrations
scripts/load-data.ts  Synthea downloader + CSV loader
data/               (gitignored) sample.zip, csv/, healthcare.db
```
