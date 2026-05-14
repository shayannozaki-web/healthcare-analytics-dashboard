import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calcAge, cleanName, formatCurrency, formatDate, titleCase } from "@/lib/format";
import {
  getPatient,
  getPatientConditions,
  getPatientEncounters,
  getPatientMedications,
  getReferenceDate,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type Demographic = { label: string; value: string };

function demographicsFor(p: ReturnType<typeof getPatient>, ref: string): Demographic[] {
  if (!p) return [];
  return [
    { label: "Age", value: `${calcAge(p.dob, ref)} (${formatDate(p.dob)})` },
    { label: "Gender", value: p.gender === "F" ? "Female" : p.gender === "M" ? "Male" : p.gender ?? "—" },
    { label: "Race", value: titleCase(p.race) || "—" },
    { label: "Ethnicity", value: titleCase(p.ethnicity) || "—" },
    { label: "Marital", value: p.maritalStatus === "M" ? "Married" : p.maritalStatus === "S" ? "Single" : p.maritalStatus ?? "—" },
    { label: "ZIP", value: p.addressZip || "—" },
  ];
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = getPatient(id);
  if (!patient) notFound();

  const ref = getReferenceDate();
  const conditions = getPatientConditions(id);
  const medications = getPatientMedications(id);
  const encounters = getPatientEncounters(id);

  return (
    <div className="space-y-6 p-8">
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <Link href="/patients">
          <ArrowLeft className="h-4 w-4" /> Back to patients
        </Link>
      </Button>

      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {cleanName(patient.firstName)} {cleanName(patient.lastName)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Patient ID <span className="font-mono text-xs">{patient.id}</span>
          </p>
        </div>
        <Card>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 py-4 sm:grid-cols-3 lg:grid-cols-6">
            {demographicsFor(patient, ref).map((d) => (
              <div key={d.label}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{d.label}</p>
                <p className="mt-0.5 text-sm font-medium">{d.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </header>

      <Tabs defaultValue="conditions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conditions">Conditions ({conditions.length})</TabsTrigger>
          <TabsTrigger value="medications">Medications ({medications.length})</TabsTrigger>
          <TabsTrigger value="encounters">Encounters ({encounters.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="conditions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {conditions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No conditions recorded.</p>
              ) : (
                conditions.map((c, i) => (
                  <div key={`${c.code}-${c.onsetDate}-${i}`} className="flex items-start justify-between gap-4 border-b py-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{c.description ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">SNOMED {c.code ?? "—"}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Onset: {formatDate(c.onsetDate)}</p>
                      <p>Resolved: {formatDate(c.resolutionDate)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Medications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {medications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No medications recorded.</p>
              ) : (
                medications.map((m, i) => (
                  <div key={`${m.code}-${m.startDate}-${i}`} className="flex items-start justify-between gap-4 border-b py-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{m.description ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">RxNorm {m.code ?? "—"}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Start: {formatDate(m.startDate)}</p>
                      <p>Stop: {formatDate(m.stopDate)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="encounters">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Encounters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {encounters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No encounters recorded.</p>
              ) : (
                encounters.map((e) => (
                  <div key={e.id} className="flex items-start justify-between gap-4 border-b py-2 last:border-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="capitalize">{e.encounterClass ?? "—"}</Badge>
                        <p className="text-sm font-medium">{e.reasonDescription ?? "Encounter"}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(e.startDate)}
                        {e.endDate ? ` → ${formatDate(e.endDate)}` : ""}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatCurrency(e.totalCost)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />
      <p className="text-xs text-muted-foreground">Synthetic patient · no PHI</p>
    </div>
  );
}
