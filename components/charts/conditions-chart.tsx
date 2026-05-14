"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ConditionsChart({
  data,
}: {
  data: Array<{ description: string; patientCount: number }>;
}) {
  const truncate = (s: string) => (s.length > 32 ? `${s.slice(0, 30)}…` : s);
  const display = data.map((row) => ({ ...row, label: truncate(row.description) }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={display}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 11 }}
            width={180}
            interval={0}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(_, payload) =>
              payload && payload[0] ? (payload[0].payload as { description: string }).description : ""
            }
            formatter={(value) => [value, "patients"]}
          />
          <Bar dataKey="patientCount" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
