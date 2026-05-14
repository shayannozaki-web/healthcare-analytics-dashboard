import { AskForm } from "@/components/ask/ask-form";
import { requireSeeded } from "@/lib/require-seeded";

export const dynamic = "force-dynamic";

export default async function AskPage() {
  await requireSeeded();
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ask</h1>
        <p className="text-sm text-muted-foreground">
          Ask a question in plain English. Claude generates SQL, we execute it read-only against the
          synthetic database, and you see the result as a table or chart.
        </p>
      </header>

      <AskForm />

      <footer className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground">
        <p>
          <strong>How this works:</strong> Your question is sent to Claude (claude-sonnet-4-6) with a
          description of the database schema. Claude responds with a single SQL SELECT statement,
          which is validated (no INSERT/UPDATE/DELETE/DROP/ALTER/PRAGMA) and executed against a
          read-only SQLite connection.
        </p>
      </footer>
    </div>
  );
}
