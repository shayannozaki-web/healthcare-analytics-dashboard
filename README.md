# Healthcare Analytics Dashboard

AI-powered analytics for healthcare operations. Plain English questions become SQL, executed against a synthetic patient database, with results rendered as interactive charts and tables.

https://github.com/user-attachments/assets/495905ae-7588-4ebf-9987-06369497418c

## What it does

A web-based internal analytics tool modeled on what a real healthcare operations team would use. Three core surfaces:

**Dashboard.** Operational KPIs (active patients, monthly encounters, average inpatient length of stay, 30-day readmission rate) plus trend charts for encounters by class and top conditions by patient count.

**Patients.** Filterable table of the patient population by age, gender, and condition, with drill-through to individual patient detail pages showing conditions, medications, and encounters chronologically.

**Ask.** The centerpiece. A user types a question like "what are the 10 most common conditions" in plain English. Claude generates a SQL SELECT statement, the app validates it (no INSERT, UPDATE, DELETE, DROP, ALTER, no PRAGMA, no statement chaining), executes it read-only against the database, and renders the result as a chart when the shape fits or a table otherwise. SQL streams in token by token so the user sees the query forming.

## Stack

- Next.js (App Router) with TypeScript
- shadcn/ui and Tailwind CSS
- Drizzle ORM
- Turso (libSQL) hosted database
- Anthropic API with `claude-sonnet-4-6` for SQL generation
- Recharts for visualizations
- Deployed on Vercel

## Synthetic data note

Built with Synthea-generated synthetic patient data because real patient data requires Business Associate Agreements and HIPAA-compliant infrastructure. The architecture is designed to extend to real PHI with proper compliance layers (encryption at rest, audit logging, role-based access controls) added.

Seed data is bundled in the repo (1,163 patients, 61k encounters, 38k conditions, 56k medications) and loaded into Turso on first run through a setup flow at `/setup`. No CLI required for deployment.

## Run locally

Visit `http://localhost:3000` and follow the setup flow.

## Built with

Built end-to-end using Claude Code as primary dev workflow, from initial scaffolding through deployment. The build was structured in five phases: scaffolding, data loading, dashboard pages, AI query layer, and polish plus deploy.

The natural-language SQL layer is the most technically interesting piece. It pushes beyond a chat wrapper by handling schema injection, JSON-mode output with chart-type metadata, token-by-token streaming, read-only SQL validation at the application layer, and automatic chart-versus-table result rendering based on query shape.

Built by Shayanjafuri Nozaki.
