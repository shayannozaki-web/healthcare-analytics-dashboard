import { sqliteTable, text, real, index } from "drizzle-orm/sqlite-core";

export const patients = sqliteTable(
  "patients",
  {
    id: text("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dob: text("dob").notNull(),
    gender: text("gender"),
    race: text("race"),
    ethnicity: text("ethnicity"),
    maritalStatus: text("marital_status"),
    addressZip: text("address_zip"),
  },
  (t) => ({
    lastNameIdx: index("patients_last_name_idx").on(t.lastName),
  }),
);

export const encounters = sqliteTable(
  "encounters",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    encounterClass: text("encounter_class"),
    reasonDescription: text("reason_description"),
    totalCost: real("total_cost"),
  },
  (t) => ({
    patientIdx: index("encounters_patient_idx").on(t.patientId),
    startDateIdx: index("encounters_start_date_idx").on(t.startDate),
    classIdx: index("encounters_class_idx").on(t.encounterClass),
  }),
);

export const conditions = sqliteTable(
  "conditions",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    onsetDate: text("onset_date"),
    resolutionDate: text("resolution_date"),
    code: text("code"),
    description: text("description"),
  },
  (t) => ({
    patientIdx: index("conditions_patient_idx").on(t.patientId),
    descriptionIdx: index("conditions_description_idx").on(t.description),
  }),
);

export const medications = sqliteTable(
  "medications",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    startDate: text("start_date"),
    stopDate: text("stop_date"),
    code: text("code"),
    description: text("description"),
  },
  (t) => ({
    patientIdx: index("medications_patient_idx").on(t.patientId),
  }),
);

export const observations = sqliteTable(
  "observations",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    date: text("date"),
    code: text("code"),
    description: text("description"),
    value: text("value"),
    units: text("units"),
  },
  (t) => ({
    patientIdx: index("observations_patient_idx").on(t.patientId),
    codeIdx: index("observations_code_idx").on(t.code),
  }),
);

export type Patient = typeof patients.$inferSelect;
export type Encounter = typeof encounters.$inferSelect;
export type Condition = typeof conditions.$inferSelect;
export type Medication = typeof medications.$inferSelect;
export type Observation = typeof observations.$inferSelect;
