"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Database, Loader2, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Status = "idle" | "running" | "done" | "error";

const TABLES = ["patients", "encounters", "conditions", "medications"] as const;
type Table = (typeof TABLES)[number];

const EXPECTED: Record<Table, number> = {
  patients: 1163,
  encounters: 61459,
  conditions: 38094,
  medications: 56430,
};

export function SeedRunner({
  initialSeeded,
  initialCounts,
}: {
  initialSeeded: boolean;
  initialCounts: Record<string, number>;
}) {
  const [status, setStatus] = useState<Status>(initialSeeded ? "done" : "idle");
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [schemaMsg, setSchemaMsg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [doneCounts, setDoneCounts] = useState<Record<string, number> | null>(
    initialSeeded ? initialCounts : null,
  );

  useEffect(() => {
    setStatus(initialSeeded ? "done" : "idle");
  }, [initialSeeded]);

  async function run() {
    setStatus("running");
    setError(null);
    setSchemaMsg("");
    setDoneCounts(null);
    setCounts((c) => ({ ...c, patients: 0, encounters: 0, conditions: 0, medications: 0 }));

    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (!res.ok || !res.body) throw new Error(`Request failed: ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const ev of events) {
          const line = ev.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6));
          if (payload.kind === "schema") {
            setSchemaMsg(payload.message);
          } else if (payload.kind === "table") {
            setCounts((c) => ({ ...c, [payload.table]: payload.inserted }));
          } else if (payload.kind === "table_done") {
            setCounts((c) => ({ ...c, [payload.table]: payload.inserted }));
          } else if (payload.kind === "done") {
            setDoneCounts(payload.counts);
            setStatus("done");
          } else if (payload.kind === "error") {
            setError(payload.message);
            setStatus("error");
          }
        }
      }
    } catch (e) {
      setError((e as Error).message ?? "Unknown error");
      setStatus("error");
    }
  }

  const overallPct = TABLES.reduce(
    (acc, t) => acc + Math.min(1, (counts[t] ?? 0) / EXPECTED[t]),
    0,
  ) / TABLES.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5" />
            Database setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "done" && doneCounts && (
            <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              <div>
                <p className="font-medium text-emerald-700 dark:text-emerald-400">
                  Database seeded successfully.
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Loaded {Object.entries(doneCounts).map(([t, n]) => `${n.toLocaleString()} ${t}`).join(" · ")}
                </p>
              </div>
            </div>
          )}

          {status === "error" && error && (
            <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Seeding failed</p>
                <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                {error.toLowerCase().includes("timeout") && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    On Vercel Hobby the function caps at 60s. Click <strong>Seed database</strong>{" "}
                    again — INSERTs are idempotent, so the next run picks up where this one stopped.
                  </p>
                )}
              </div>
            </div>
          )}

          {status === "running" && (
            <div className="space-y-3">
              {schemaMsg && (
                <p className="text-xs text-muted-foreground">{schemaMsg}</p>
              )}
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round(overallPct * 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TABLES.map((t) => {
                  const expected = EXPECTED[t];
                  const got = counts[t] ?? 0;
                  const pct = Math.min(100, Math.round((got / expected) * 100));
                  return (
                    <div key={t} className="rounded-md border p-3">
                      <p className="text-xs font-medium capitalize">{t}</p>
                      <p className="mt-1 text-sm font-mono">
                        {got.toLocaleString()} / {expected.toLocaleString()}
                      </p>
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary/80" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={run} disabled={status === "running"}>
              {status === "running" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Seeding…
                </>
              ) : status === "done" ? (
                <>
                  <PlayCircle className="h-4 w-4" /> Re-seed
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" /> Seed database
                </>
              )}
            </Button>
            {status === "done" && (
              <Button asChild variant="outline">
                <Link href="/">Open dashboard</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What this does</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Applies the Drizzle schema (5 tables) and loads ~157,000 rows of pre-processed
            Synthea synthetic patient data committed to this repo under <code>seed/</code>.
            Existing rows are skipped via <code>ON CONFLICT(id) DO NOTHING</code>, so re-running
            is safe.
          </p>
          <p>
            Connects to the database at <code>TURSO_DATABASE_URL</code> using{" "}
            <code>TURSO_AUTH_TOKEN</code>, both read from the deployment&apos;s environment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
