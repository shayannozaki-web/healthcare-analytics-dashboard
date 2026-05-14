# Healthcare Analytics Dashboard

An internal-style analytics dashboard for healthcare operations: a patient population view, key operational KPIs, and a natural-language query layer that turns plain-English questions into validated SQL and renders the results as a chart or table. Portfolio project that mirrors the architecture of a real internal analytics tool used in regulated healthcare settings.

> _GIF of the /ask page goes here — short loop showing a question typed in, SQL streaming token-by-token, and the result rendering as a chart._

## Stack

- **Next.js** (App Router) + TypeScript
- **shadcn/ui** + Tailwind CSS
- **libSQL** via Turso in production, local SQLite file in development; schema managed by **Drizzle ORM**
- **Recharts** for visualizations
- **Anthropic SDK** with `claude-sonnet-4-6` for the natural-language SQL generation; result streamed over SSE
- **Synthea** for the synthetic patient dataset

## Synthetic data only

Built with [Synthea](https://github.com/synthetichealth/synthea)-generated synthetic patient data because real patient data requires BAAs and HIPAA-compliant infrastructure. The architecture is designed to extend to real PHI with proper compliance layers (encryption at rest, audit logging, access controls) added.

## Features

- **Overview dashboard at `/`** — four KPI cards (active patients, encounters this month, average inpatient length of stay, 30-day readmission rate) and two charts (encounters per month by class, top 10 conditions).
- **Patient population at `/patients`** — paginated table (50 / page) with age-range, gender, and top-20-conditions filters. Filter state lives in the URL.
- **Patient detail at `/patients/[id]`** — demographics header plus Conditions / Medications / Encounters tabs. Unknown IDs return a real 404.
- **AI query interface at `/ask`** — type a question, watch the SQL stream token-by-token, then see the result auto-rendered as a chart (line for time series, bar for categorical) or a table.

### Safety on `/ask`

- The SQL guard rejects anything that isn't a single `SELECT` (or `WITH ... SELECT`) — `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `REPLACE`, `TRUNCATE`, `ATTACH`, `DETACH`, `PRAGMA`, `VACUUM`, `REINDEX`, `ANALYZE`, `GRANT`, `REVOKE`, and `MERGE` are all blocked at the application layer.
- Comments are stripped before keyword scanning; semicolons in the middle of a statement are rejected.
- A separate read-only-style libSQL connection executes the query; results are capped at 1,000 rows.

## Run locally

Requires Node 20+ and a Unix `unzip` on `PATH`.

```bash
git clone https://github.com/shayannozaki-web/healthcare-analytics-dashboard
cd healthcare-analytics-dashboard
npm install
cp .env.example .env.local            # add your ANTHROPIC_API_KEY
npm run db:reset                      # downloads ~57 MB Synthea sample, loads ~1k patients
npm run dev                           # http://localhost:3000
```

`db:reset` deletes any existing `data/healthcare.db` and rebuilds it from scratch. `db:load` loads into an existing DB. Both cache the downloaded zip and extracted CSVs under `data/`.

## Deploying to Vercel with Turso

Vercel's serverless runtime can't host a local SQLite file at runtime, so production uses [Turso](https://turso.tech) (managed libSQL). The library client speaks libSQL whether it's pointed at a local file or a remote Turso URL.

```bash
# Provision the Turso DB
turso db create healthcare
turso db import healthcare data/healthcare.db
turso db show healthcare --url               # → TURSO_DATABASE_URL
turso db tokens create healthcare            # → TURSO_AUTH_TOKEN

# In the Vercel project, set environment variables:
#   ANTHROPIC_API_KEY      = sk-ant-…
#   TURSO_DATABASE_URL     = libsql://healthcare-<org>.turso.io
#   TURSO_AUTH_TOKEN       = <token>

vercel --prod
```

When `TURSO_DATABASE_URL` is unset (local dev), the app falls back to `file:./data/healthcare.db`.

## Project layout

```
app/
  page.tsx                  Dashboard (KPIs + charts)
  patients/page.tsx         Patient population list
  patients/[id]/page.tsx    Patient detail
  ask/page.tsx              /ask UI
  api/ask/route.ts          SSE endpoint: Claude + SQL guard + executor
components/                 UI primitives, sidebar, charts, /ask widgets
db/
  schema.ts                 Drizzle schema (5 tables)
  client.ts                 libSQL client (local file in dev, Turso in prod)
  migrations/               Generated Drizzle migrations
lib/
  queries.ts                Typed query functions for KPIs, lists, detail
  sql-guard.ts              SELECT-only validator with keyword denylist
  sql-runner.ts             Read-only async executor with row cap
  result-shape.ts           Chart-vs-table shape detector
  ask-schema.ts             Schema description and system prompt for Claude
scripts/
  load-data.ts              Synthea downloader + CSV bulk loader
```

## Built with

Built end-to-end using Claude Code as the primary dev workflow. Total build time: ~6 focused hours across one session.
