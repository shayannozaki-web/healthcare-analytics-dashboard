import { client } from "@/db/client";

async function queryOne<T>(sql: string, args: Array<string | number> = []): Promise<T> {
  const result = await client.execute({ sql, args });
  if (result.rows.length === 0) throw new Error("Expected exactly one row, got 0");
  const row = result.rows[0];
  return Object.fromEntries(result.columns.map((c) => [c, row[c]])) as T;
}

async function queryAll<T>(sql: string, args: Array<string | number> = []): Promise<T[]> {
  const result = await client.execute({ sql, args });
  return result.rows.map(
    (r) => Object.fromEntries(result.columns.map((c) => [c, r[c]])) as T,
  );
}

let cachedReferenceDate: string | null = null;
export async function getReferenceDate(): Promise<string> {
  if (cachedReferenceDate) return cachedReferenceDate;
  const row = await queryOne<{ max: string | null }>(
    "SELECT MAX(start_date) AS max FROM encounters",
  );
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

export async function getKpis(): Promise<Kpis> {
  const ref = await getReferenceDate();
  const monthPrefix = ref.slice(0, 7);
  const yearAgo = new Date(ref);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearAgoIso = yearAgo.toISOString().slice(0, 10);

  const { active } = await queryOne<{ active: number }>(
    `SELECT COUNT(DISTINCT patient_id) AS active
     FROM encounters
     WHERE substr(start_date, 1, 10) >= ?`,
    [yearAgoIso],
  );

  const { thisMonth } = await queryOne<{ thisMonth: number }>(
    `SELECT COUNT(*) AS thisMonth
     FROM encounters
     WHERE substr(start_date, 1, 7) = ?`,
    [monthPrefix],
  );

  const { avgLos } = await queryOne<{ avgLos: number | null }>(
    `SELECT AVG(julianday(end_date) - julianday(start_date)) AS avgLos
     FROM encounters
     WHERE encounter_class = 'inpatient'
       AND end_date IS NOT NULL
       AND end_date > start_date`,
  );

  const readmit = await queryOne<{ readmits: number | null; discharges: number }>(
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
  );

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
  month: string;
  wellness: number;
  ambulatory: number;
  outpatient: number;
  inpatient: number;
  emergency: number;
  urgentcare: number;
};

export async function getEncountersByMonth(): Promise<EncountersByMonth[]> {
  const ref = await getReferenceDate();
  const start = new Date(ref);
  start.setMonth(start.getMonth() - 11);
  start.setDate(1);
  const startPrefix = start.toISOString().slice(0, 7);

  const rows = await queryAll<{ month: string; class: string | null; n: number }>(
    `SELECT substr(start_date, 1, 7) AS month,
            encounter_class AS class,
            COUNT(*) AS n
     FROM encounters
     WHERE substr(start_date, 1, 7) >= ?
       AND substr(start_date, 1, 7) <= ?
     GROUP BY month, encounter_class`,
    [startPrefix, ref.slice(0, 7)],
  );

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

export async function getTopConditions(
  limit: number,
): Promise<Array<{ description: string; patientCount: number }>> {
  return queryAll<{ description: string; patientCount: number }>(
    `SELECT description, COUNT(DISTINCT patient_id) AS patientCount
     FROM conditions
     WHERE description IS NOT NULL
     GROUP BY description
     ORDER BY patientCount DESC
     LIMIT ?`,
    [limit],
  );
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

export async function listPatients(
  filters: PatientFilters = {},
): Promise<PatientListResult> {
  const ref = await getReferenceDate();
  const pageSize = filters.pageSize ?? 50;
  const page = Math.max(1, filters.page ?? 1);
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const filterArgs: Array<string | number> = [];

  if (filters.minAge != null) {
    where.push("(julianday(?) - julianday(p.dob)) / 365.25 >= ?");
    filterArgs.push(ref, filters.minAge);
  }
  if (filters.maxAge != null) {
    where.push("(julianday(?) - julianday(p.dob)) / 365.25 < ?");
    filterArgs.push(ref, filters.maxAge + 1);
  }
  if (filters.gender) {
    where.push("p.gender = ?");
    filterArgs.push(filters.gender);
  }
  if (filters.conditions && filters.conditions.length > 0) {
    const placeholders = filters.conditions.map(() => "?").join(",");
    where.push(
      `EXISTS (SELECT 1 FROM conditions c WHERE c.patient_id = p.id AND c.description IN (${placeholders}))`,
    );
    filterArgs.push(...filters.conditions);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRow = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM patients p ${whereClause}`,
    filterArgs,
  );

  const rows = await queryAll<PatientListRow>(
    `SELECT
       p.id,
       p.first_name AS firstName,
       p.last_name AS lastName,
       CAST((julianday(?) - julianday(p.dob)) / 365.25 AS INTEGER) AS age,
       p.gender,
       (SELECT COUNT(*) FROM conditions c WHERE c.patient_id = p.id) AS conditionCount,
       (SELECT MAX(start_date) FROM encounters e WHERE e.patient_id = p.id) AS lastEncounterDate
     FROM patients p
     ${whereClause}
     ORDER BY p.last_name, p.first_name
     LIMIT ? OFFSET ?`,
    [ref, ...filterArgs, pageSize, offset],
  );

  return { rows, total: countRow.n, page, pageSize };
}

export type PatientDetail = {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string | null;
  race: string | null;
  ethnicity: string | null;
  maritalStatus: string | null;
  addressZip: string | null;
};

export async function getPatient(id: string): Promise<PatientDetail | null> {
  const result = await client.execute({
    sql: `SELECT id, first_name AS firstName, last_name AS lastName, dob,
                 gender, race, ethnicity, marital_status AS maritalStatus, address_zip AS addressZip
          FROM patients WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return Object.fromEntries(result.columns.map((c) => [c, row[c]])) as PatientDetail;
}

export async function getPatientConditions(patientId: string) {
  return queryAll<{
    description: string | null;
    code: string | null;
    onsetDate: string | null;
    resolutionDate: string | null;
  }>(
    `SELECT description, code, onset_date AS onsetDate, resolution_date AS resolutionDate
     FROM conditions
     WHERE patient_id = ?
     ORDER BY onset_date DESC NULLS LAST`,
    [patientId],
  );
}

export async function getPatientMedications(patientId: string) {
  return queryAll<{
    description: string | null;
    code: string | null;
    startDate: string | null;
    stopDate: string | null;
  }>(
    `SELECT description, code, start_date AS startDate, stop_date AS stopDate
     FROM medications
     WHERE patient_id = ?
     ORDER BY start_date DESC NULLS LAST`,
    [patientId],
  );
}

export async function getPatientEncounters(patientId: string) {
  return queryAll<{
    id: string;
    startDate: string;
    endDate: string | null;
    encounterClass: string | null;
    reasonDescription: string | null;
    totalCost: number | null;
  }>(
    `SELECT id, start_date AS startDate, end_date AS endDate,
            encounter_class AS encounterClass, reason_description AS reasonDescription,
            total_cost AS totalCost
     FROM encounters
     WHERE patient_id = ?
     ORDER BY start_date DESC`,
    [patientId],
  );
}
