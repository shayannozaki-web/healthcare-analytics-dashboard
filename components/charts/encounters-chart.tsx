"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMonth } from "@/lib/format";
import type { EncountersByMonth } from "@/lib/queries";

const SERIES: Array<{ key: keyof EncountersByMonth; label: string; color: string }> = [
  { key: "wellness", label: "Wellness", color: "hsl(var(--chart-1))" },
  { key: "ambulatory", label: "Ambulatory", color: "hsl(var(--chart-2))" },
  { key: "outpatient", label: "Outpatient", color: "hsl(var(--chart-3))" },
  { key: "inpatient", label: "Inpatient", color: "hsl(var(--chart-4))" },
  { key: "emergency", label: "Emergency", color: "hsl(var(--chart-5))" },
  { key: "urgentcare", label: "Urgent care", color: "hsl(220, 70%, 50%)" },
];

export function EncountersChart({ data }: { data: EncountersByMonth[] }) {
  const display = data.map((row) => ({ ...row, label: formatMonth(row.month) }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={display} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
