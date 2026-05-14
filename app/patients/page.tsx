import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PatientFilters } from "@/components/patients/patient-filters";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cleanName, formatDate, formatNumber } from "@/lib/format";
import { getTopConditions, listPatients } from "@/lib/queries";
import { requireSeeded } from "@/lib/require-seeded";

export const dynamic = "force-dynamic";

type SearchParams = {
  minAge?: string;
  maxAge?: string;
  gender?: string;
  condition?: string | string[];
  page?: string;
};

function parseInt(v: string | undefined, fallback: number): number {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function paramArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSeeded();
  const sp = await searchParams;
  const minAge = parseInt(sp.minAge, 0);
  const maxAge = parseInt(sp.maxAge, 100);
  const gender = sp.gender ?? "";
  const conditions = paramArray(sp.condition);
  const page = parseInt(sp.page, 1);
  const pageSize = 50;

  const [conditionRows, listResult] = await Promise.all([
    getTopConditions(20),
    listPatients({
      minAge: minAge === 0 ? undefined : minAge,
      maxAge: maxAge === 100 ? undefined : maxAge,
      gender: gender || undefined,
      conditions: conditions.length > 0 ? conditions : undefined,
      page,
      pageSize,
    }),
  ]);
  const conditionOptions = conditionRows.map((c) => c.description);
  const { rows, total } = listResult;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const buildPageHref = (target: number) => {
    const params = new URLSearchParams();
    if (sp.minAge) params.set("minAge", sp.minAge);
    if (sp.maxAge) params.set("maxAge", sp.maxAge);
    if (sp.gender) params.set("gender", sp.gender);
    for (const c of conditions) params.append("condition", c);
    if (target !== 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/patients?${qs}` : "/patients";
  };

  return (
    <div className="space-y-4 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
        <p className="text-sm text-muted-foreground">
          {formatNumber(total)} patient{total === 1 ? "" : "s"} match · page {page} of {totalPages}
        </p>
      </header>

      <PatientFilters
        conditionOptions={conditionOptions}
        initial={{ age: [minAge, maxAge], gender, conditions }}
      />

      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-20 text-right">Age</TableHead>
              <TableHead className="w-24">Gender</TableHead>
              <TableHead className="w-32 text-right">Conditions</TableHead>
              <TableHead className="w-48">Last encounter</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  No patients match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={p.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/patients/${p.id}`} className="block py-1 hover:underline">
                      {cleanName(p.firstName)} {cleanName(p.lastName)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/patients/${p.id}`} className="block py-1">
                      {p.age}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/patients/${p.id}`} className="block py-1">
                      {p.gender === "F" ? "Female" : p.gender === "M" ? "Male" : (p.gender ?? "—")}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/patients/${p.id}`} className="block py-1">
                      {p.conditionCount}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/patients/${p.id}`} className="block py-1">
                      {formatDate(p.lastEncounterDate)}
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {rows.length === 0 ? 0 : (page - 1) * pageSize + 1}–
          {(page - 1) * pageSize + rows.length} of {formatNumber(total)}
        </p>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildPageHref(page - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
          )}
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildPageHref(page + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
