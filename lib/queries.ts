import { sqlite } from "@/db/client";

// Synthea sample data is static (Nov 2021). We anchor "now" to the latest encounter
// so phrases like "this month" and "last 12 months" return meaningful results.
let cachedReferenceDate: string | null = null;
export function getReferenceDate(): string {
  if (cachedReferenceDate) return cachedReferenceDate;
  const row = sqlite
    .prepare("SELECT MAX(start_date) AS max FROM encounters")
    .get() as { max: string | null };
  cachedReferenceDate = row.max ?? new Date().toISOString().slice(0, 10);
  return cachedReferenceDate;
}

export type Kpis = {
  activePatients: number;
  encountersThisMonth: number;
  avgInpatientLosDays: number | null;
  readmissionRate30d: number | null;
  referenceDate: string;
};

export function getKpis(): Kpis {
  const ref = getReferenceDate();
  const monthPrefix = ref.slice(0, 7); // YYYY-MM
  const yearAgo = new Date(ref);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearAgoIso = yearAgo.toISOString().slice(0, 10);

  const { active } = sqlite
    .prepare(
      `SELECT COUNT(DISTINCT patient_id) AS active
       FROM encounters
       WHERE substr(start_date, 1, 10) >= ?`,
    )
    .get(yearAgoIso) as { active: number };

  const { thisMonth } = sqlite
    .prepare(
      `SELECT COUNT(*) AS thisMonth
       FROM encounters
       WHERE substr(start_date, 1, 7) = ?`,
    )
    .get(monthPrefix) as { thisMonth: number };

  const { avgLos } = sqlite
    .prepare(
      `SELECT AVG(julianday(end_date) - julianday(start_date)) AS avgLos
       FROM encounters
       WHERE encounter_class = 'inpatient'
         AND end_date IS NOT NULL
         AND end_date > start_date`,
    )
    .get() as { avgLos: number | null };

  // 30-day readmission: percent of inpatient discharges followed by another
  // inpatient admission for the same patient within 30 days.
  const readmit = sqlite
    .prepare(
      `WITH ip AS (
         SELECT patient_id, start_date, end_date,
                LEAD(start_date) OVER (PARTITION BY patient_id ORDER BY start_date) AS next_start
         FROM encounters
         WHERE encounter_class = 'inpatient' AND end_date IS NOT NULL
       )
       SELECT
         SUM(CASE WHEN next_start IS NOT NULL
                   AND julianday(next_start) - julianday(end_date) <= 30
                   AND julianday(next_start) - julianday(end_date) >= 0
                  THEN 1 ELSE 0 END) AS readmits,
         COUNT(*) AS discharges
       FROM ip`,
    )
    .get() as { readmits: number | null; discharges: number };

  return {
    activePatients: active,
    encountersThisMonth: thisMonth,
    avgInpatientLosDays: avgLos,
    readmissionRate30d:
      readmit.discharges > 0 ? (readmit.readmits ?? 0) / readmit.discharges : null,
    referenceDate: ref,
  };
}

export type EncountersByMonth = {
  month: string; // YYYY-MM
  wellness: number;
  ambulatory: number;
  outpatient: number;
  inpatient: number;
  emergency: number;
  urgentcare: number;
};

export function getEncountersByMonth(): EncountersByMonth[] {
  const ref = getReferenceDate();
  const start = new Date(ref);
  start.setMonth(start.getMonth() - 11);
  start.setDate(1);
  const startPrefix = start.toISOString().slice(0, 7);

  const rows = sqlite
    .prepare(
      `SELECT substr(start_date, 1, 7) AS month,
              encounter_class AS class,
              COUNT(*) AS n
       FROM encounters
       WHERE substr(start_date, 1, 7) >= ?
         AND substr(start_date, 1, 7) <= ?
       GROUP BY month, encounter_class`,
    )
    .all(startPrefix, ref.slice(0, 7)) as Array<{
      month: string;
      class: string | null;
      n: number;
    }>;

  const months: string[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < 12; i++) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const map = new Map<string, EncountersByMonth>();
  for (const month of months) {
    map.set(month, {
      month,
      wellness: 0,
      ambulatory: 0,
      outpatient: 0,
      inpatient: 0,
      emergency: 0,
      urgentcare: 0,
    });
  }
  for (const r of rows) {
    const m = map.get(r.month);
    if (!m || !r.class) continue;
    if (r.class in m) (m as unknown as Record<string, number>)[r.class] = r.n;
  }
  return months.map((m) => map.get(m)!);
}

export function getTopConditions(limit: number): Array<{ description: string; patientCount: number }> {
  return sqlite
    .prepare(
      `SELECT description, COUNT(DISTINCT patient_id) AS patientCount
       FROM conditions
       WHERE description IS NOT NULL
       GROUP BY description
       ORDER BY patientCount DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{ description: string; patientCount: number }>;
}

// ---------- Patients list / detail ----------

export type PatientListRow = {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: string | null;
  conditionCount: number;
  lastEncounterDate: string | null;
};

export type PatientFilters = {
  minAge?: number;
  maxAge?: number;
  gender?: string;
  conditions?: string[];
  page?: number;
  pageSize?: number;
};

export type PatientListResult = {
  rows: PatientListRow[];
  total: number;
  page: number;
  pageSize: number;
};

export function listPatients(filters: PatientFilters = {}): PatientListResult {
  const ref = getReferenceDate();
  const pageSize = filters.pageSize ?? 50;
  const page = Math.max(1, filters.page ?? 1);
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: Array<string | number> = [ref];

  if (filters.minAge != null) {
    conditions.push("(julianday(?) - julianday(p.dob)) / 365.25 >= ?");
    params.push(ref, filters.minAge);
  }
  if (filters.maxAge != null) {
    conditions.push("(julianday(?) - julianday(p.dob)) / 365.25 < ?");
    params.push(ref, filters.maxAge + 1);
  }
  if (filters.gender) {
    conditions.push("p.gender = ?");
    params.push(filters.gender);
  }
  if (filters.conditions && filters.conditions.length > 0) {
    const placeholders = filters.conditions.map(() => "?").join(",");
    conditions.push(
      `EXISTS (SELECT 1 FROM conditions c WHERE c.patient_id = p.id AND c.description IN (${placeholders}))`,
    );
    params.push(...filters.conditions);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRow = sqlite
    .prepare(`SELECT COUNT(*) AS n FROM patients p ${where}`)
    .get(...params.slice(1)) as { n: number };

  const rows = sqlite
    .prepare(
      `SELECT
         p.id,
         p.first_name AS firstName,
         p.last_name AS lastName,
         CAST((julianday(?) - julianday(p.dob)) / 365.25 AS INTEGER) AS age,
         p.gender,
         (SELECT COUNT(*) FROM conditions c WHERE c.patient_id = p.id) AS conditionCount,
         (SELECT MAX(start_date) FROM encounters e WHERE e.patient_id = p.id) AS lastEncounterDate
       FROM patients p
       ${where}
       ORDER BY p.last_name, p.first_name
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset) as PatientListRow[];

  return { rows, total: countRow.n, page, pageSize };
}

export function getPatient(id: string) {
  return sqlite
    .prepare(
      `SELECT id, first_name AS firstName, last_name AS lastName, dob,
              gender, race, ethnicity, marital_status AS maritalStatus, address_zip AS addressZip
       FROM patients WHERE id = ?`,
    )
    .get(id) as
    | {
        id: string;
        firstName: string;
        lastName: string;
        dob: string;
        gender: string | null;
        race: string | null;
        ethnicity: string | null;
        maritalStatus: string | null;
        addressZip: string | null;
      }
    | undefined;
}

export function getPatientConditions(patientId: string) {
  return sqlite
    .prepare(
      `SELECT description, code, onset_date AS onsetDate, resolution_date AS resolutionDate
       FROM conditions
       WHERE patient_id = ?
       ORDER BY onset_date DESC NULLS LAST`,
    )
    .all(patientId) as Array<{
      description: string | null;
      code: string | null;
      onsetDate: string | null;
      resolutionDate: string | null;
    }>;
}

export function getPatientMedications(patientId: string) {
  return sqlite
    .prepare(
      `SELECT description, code, start_date AS startDate, stop_date AS stopDate
       FROM medications
       WHERE patient_id = ?
       ORDER BY start_date DESC NULLS LAST`,
    )
    .all(patientId) as Array<{
      description: string | null;
      code: string | null;
      startDate: string | null;
      stopDate: string | null;
    }>;
}

export function getPatientEncounters(patientId: string) {
  return sqlite
    .prepare(
      `SELECT id, start_date AS startDate, end_date AS endDate,
              encounter_class AS encounterClass, reason_description AS reasonDescription,
              total_cost AS totalCost
       FROM encounters
       WHERE patient_id = ?
       ORDER BY start_date DESC`,
    )
    .all(patientId) as Array<{
      id: string;
      startDate: string;
      endDate: string | null;
      encounterClass: string | null;
      reasonDescription: string | null;
      totalCost: number | null;
    }>;
}
