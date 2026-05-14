import { AlertTriangle } from "lucide-react";

import { SeedRunner } from "@/components/setup/seed-runner";
import { isSeeded, rowCounts } from "@/lib/seed";

export const dynamic = "force-dynamic";

const missingEnv = (): string[] => {
  // Only enforce the Turso vars when running on Vercel (production). Local dev
  // uses the SQLite file at data/healthcare.db and doesn't need them.
  if (!process.env.VERCEL && process.env.NODE_ENV !== "production") return [];
  const missing: string[] = [];
  if (!process.env.TURSO_DATABASE_URL) missing.push("TURSO_DATABASE_URL");
  if (!process.env.TURSO_AUTH_TOKEN) missing.push("TURSO_AUTH_TOKEN");
  return missing;
};

export default async function SetupPage() {
  const missing = missingEnv();

  if (missing.length > 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Setup</h1>
        </header>
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <div className="space-y-2">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              Missing environment variables
            </p>
            <p className="text-amber-900/80 dark:text-amber-200/80">
              This deployment is missing {missing.map((v) => <code key={v} className="mx-1 rounded bg-amber-100 px-1 dark:bg-amber-900/50">{v}</code>)}.
              Add these in your Vercel project settings under <strong>Settings → Environment
              Variables</strong>, then redeploy.
            </p>
            <p className="text-xs text-amber-900/70 dark:text-amber-200/70">
              Get the values from your Turso dashboard: the database URL appears on the database&apos;s
              page, and the auth token is created with the &quot;Create Token&quot; button.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [seeded, counts] = await Promise.all([isSeeded(), rowCounts()]);
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One-time database seeding for your Turso instance. After this, the dashboard, patient
          views, and Ask page will work.
        </p>
      </header>
      <SeedRunner initialSeeded={seeded} initialCounts={counts} />
    </div>
  );
}
