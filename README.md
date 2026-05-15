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
- **One-click setup at `/setup`** — first time you visit a fresh deployment, you're redirected here to seed the database from the Synthea bundle committed to this repo. No CLI required.

### Safety on `/ask`

- The SQL guard rejects anything that isn't a single `SELECT` (or `WITH ... SELECT`) — `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `REPLACE`, `TRUNCATE`, `ATTACH`, `DETACH`, `PRAGMA`, `VACUUM`, `REINDEX`, `ANALYZE`, `GRANT`, `REVOKE`, and `MERGE` are all blocked at the application layer.
- Comments are stripped before keyword scanning; semicolons in the middle of a statement are rejected.
- A separate read-only-style libSQL connection executes the query; results are capped at 1,000 rows.

## Deploy with web UIs only

You can stand this up end-to-end without touching a CLI on your machine.

### 1. Create the Turso database (Turso dashboard)

1. Sign up at [turso.tech](https://turso.tech).
2. From the dashboard, click **Create database** → name it `healthcare` (or anything you like) → pick a region close to your Vercel region.
3. On the database's page, copy the **Database URL** (`libsql://…`). Keep this tab open.
4. Click **Create Token** → copy the auth token. You now have the two values you need.

Leave the database empty — the app seeds itself on first visit.

### 2. Deploy on Vercel (Vercel dashboard)

1. Push this repo to GitHub (already done if you're reading this).
2. Go to [vercel.com/new](https://vercel.com/new) and **Import** the repo. Vercel detects Next.js automatically; accept the defaults.
3. Before clicking Deploy, expand **Environment Variables** and add:
   - `ANTHROPIC_API_KEY` — your Claude API key from [console.anthropic.com](https://console.anthropic.com).
   - `TURSO_DATABASE_URL` — the URL from step 1.3.
   - `TURSO_AUTH_TOKEN` — the token from step 1.4.
4. Click **Deploy**. First build takes ~2 minutes.

### 3. Seed the database (in your browser)

1. When the deploy finishes, open your live URL. You'll be redirected to `/setup`.
2. Click **Seed database**. A progress bar shows each of the four tables filling up — about a minute on Vercel Pro, possibly longer on Hobby.
3. If you're on Vercel Hobby and the request hits the 60-second function limit, you'll see an error. Just click **Seed database** again — the seed is idempotent (`INSERT … ON CONFLICT(id) DO NOTHING`) and resumes where it left off. Two or three clicks total is enough.
4. When you see "Database seeded successfully," click **Open dashboard**.

Done — the dashboard, patients view, and Ask page now have data to work with.

### Notes on Hobby vs. Pro

The seed loads ~157,000 rows over the network. On Vercel Pro it fits inside one 300-second function call. On Hobby (60-second limit) you'll likely need 2–3 clicks. The seed handler streams progress so you can see exactly how far each pass got before timing out.

## Run locally

If you do want to run locally:

```bash
git clone https://github.com/shayannozaki-web/healthcare-analytics-dashboard
cd healthcare-analytics-dashboard
npm install
cp .env.example .env.local            # add your ANTHROPIC_API_KEY
npm run db:reset                      # downloads ~57 MB Synthea sample, loads ~1k patients
npm run dev                           # http://localhost:3000
```

Local dev uses `data/healthcare.db` directly — `TURSO_DATABASE_URL` only kicks in when set.

## Project layout

```
app/
  page.tsx                  Dashboard (KPIs + charts)
  patients/page.tsx         Patient population list
  patients/[id]/page.tsx    Patient detail
  ask/page.tsx              /ask UI
  setup/page.tsx            One-click DB seed UI
  api/ask/route.ts          SSE: Claude + SQL guard + executor
  api/seed/route.ts         SSE: streams Synthea bundle into Turso
components/                 UI primitives, sidebar, charts, /ask + /setup widgets
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
  seed.ts                   Reads seed/*.jsonl.gz and bulk-inserts via libSQL batches
  require-seeded.ts         Server guard that redirects empty deployments to /setup
seed/                       Pre-built Synthea bundle (gzipped JSONL, ~3.6 MB)
scripts/
  load-data.ts              Synthea downloader + local SQLite loader
  build-seed.ts             Builds seed/ bundle from local CSVs
```

## Built with

Built end-to-end using Claude Code as the primary dev workflow. Total build time: ~7 focused hours across one session.
