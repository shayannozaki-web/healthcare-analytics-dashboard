import { Activity, BedDouble, CalendarDays, Repeat } from "lucide-react";

import { ConditionsChart } from "@/components/charts/conditions-chart";
import { EncountersChart } from "@/components/charts/encounters-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDays, formatNumber, formatPercent } from "@/lib/format";
import { getEncountersByMonth, getKpis, getTopConditions } from "@/lib/queries";

export const dynamic = "force-dynamic";

type KpiCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
};

function KpiCard({ label, value, hint, icon: Icon }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const kpis = getKpis();
  const encounters = getEncountersByMonth();
  const conditions = getTopConditions(10);

  return (
    <div className="space-y-6 p-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Operational overview · data as of {formatDate(kpis.referenceDate)}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Active patients"
          value={formatNumber(kpis.activePatients)}
          hint="With an encounter in the last 12 months"
          icon={Activity}
        />
        <KpiCard
          label="Encounters this month"
          value={formatNumber(kpis.encountersThisMonth)}
          hint={formatDate(kpis.referenceDate).slice(0, -3) + ` (as of data)`}
          icon={CalendarDays}
        />
        <KpiCard
          label="Avg inpatient LOS"
          value={formatDays(kpis.avgInpatientLosDays)}
          hint="All inpatient stays in dataset"
          icon={BedDouble}
        />
        <KpiCard
          label="30-day readmission rate"
          value={formatPercent(kpis.readmissionRate30d)}
          hint="Inpatient readmits within 30 days of discharge"
          icon={Repeat}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Encounters per month, by class</CardTitle>
            <CardDescription>Trailing 12 months from {formatDate(kpis.referenceDate)}</CardDescription>
          </CardHeader>
          <CardContent>
            <EncountersChart data={encounters} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 conditions</CardTitle>
            <CardDescription>By distinct patient count</CardDescription>
          </CardHeader>
          <CardContent>
            <ConditionsChart data={conditions} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
