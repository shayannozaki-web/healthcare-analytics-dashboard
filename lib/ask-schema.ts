export const SCHEMA_DESCRIPTION = `Tables (SQLite):

patients(id TEXT PK, first_name TEXT, last_name TEXT, dob TEXT (YYYY-MM-DD), gender TEXT ('M'|'F'),
         race TEXT, ethnicity TEXT, marital_status TEXT, address_zip TEXT)

encounters(id TEXT PK, patient_id TEXT FK -> patients.id,
           start_date TEXT (ISO 8601 timestamp), end_date TEXT (nullable),
           encounter_class TEXT (one of: 'wellness','ambulatory','outpatient','inpatient','emergency','urgentcare'),
           reason_description TEXT, total_cost REAL)

conditions(id TEXT PK, patient_id TEXT FK,
           onset_date TEXT, resolution_date TEXT (nullable),
           code TEXT (SNOMED), description TEXT)

medications(id TEXT PK, patient_id TEXT FK,
            start_date TEXT, stop_date TEXT (nullable),
            code TEXT (RxNorm), description TEXT)

observations(id TEXT PK, patient_id TEXT FK,
             date TEXT, code TEXT (LOINC), description TEXT,
             value TEXT (cast to REAL when used numerically), units TEXT)

Notes:
- This is synthetic Synthea data. The latest record dates are around 2021-11-19. Treat phrases like 'current', 'this year', or 'recent' relative to that reference date, not the actual current date.
- Compute age in years as (julianday('2021-11-19') - julianday(dob)) / 365.25.
- Date columns are ISO strings; use substr(col, 1, 7) for year-month grouping or substr(col, 1, 4) for year.
- Match condition descriptions with LIKE when the user gives a casual term (e.g. 'diabetes' should match descriptions containing 'diabetes').`;

export const SYSTEM_PROMPT = `You are a SQL query generator for a healthcare analytics SQLite database.

${SCHEMA_DESCRIPTION}

Rules:
- Generate exactly one SQLite SELECT statement (CTEs starting with WITH are allowed).
- Never use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, REPLACE, ATTACH, PRAGMA, or VACUUM.
- Prefer descriptive column aliases (e.g. patient_count, month).
- Apply a sensible LIMIT (typically 100, or higher only when the answer is a time series).
- If the user's question is ambiguous, choose the most useful concrete interpretation rather than asking for clarification.

You MUST respond by calling the submit_query tool. Do not respond in plain text.`;

export const SAMPLE_QUESTIONS: Array<{ label: string; question: string }> = [
  { label: "Patients with diabetes", question: "How many patients have diabetes?" },
  { label: "Most common conditions", question: "Show me the 20 most common conditions" },
  {
    label: "Inpatient LOS by month (2021)",
    question: "Average length of stay for inpatient encounters in 2021, broken down by month",
  },
  {
    label: "Frequent ER patients",
    question: "Which patients have been to the ER more than 5 times?",
  },
];
