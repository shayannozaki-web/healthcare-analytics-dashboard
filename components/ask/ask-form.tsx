"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";

import { ResultView } from "@/components/ask/result-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SAMPLE_QUESTIONS } from "@/lib/ask-schema";
import type { ChartShape } from "@/lib/result-shape";

type ResultState = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  chart: ChartShape;
  truncated: boolean;
};

type Phase = "idle" | "generating" | "executing" | "done" | "error";

export function AskForm() {
  const [question, setQuestion] = useState("");
  const [sql, setSql] = useState("");
  const [explanation, setExplanation] = useState("");
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const abortRef = useRef<AbortController | null>(null);

  const submit = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setQuestion(trimmed);
      setSql("");
      setExplanation("");
      setResult(null);
      setError(null);
      setPhase("generating");

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Request failed: ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const block of events) {
            const line = block.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const payload = JSON.parse(line.slice(6));
            switch (payload.event) {
              case "sql_delta":
                setSql((s) => s + payload.text);
                break;
              case "meta":
                setExplanation(payload.explanation);
                setSql(payload.sql);
                setPhase("executing");
                break;
              case "result":
                setResult({
                  columns: payload.columns,
                  rows: payload.rows,
                  chart: payload.chart,
                  truncated: payload.truncated,
                });
                setPhase("done");
                break;
              case "error":
                setError(payload.message);
                setPhase("error");
                break;
            }
          }
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message ?? "Unknown error");
        setPhase("error");
      }
    },
    [],
  );

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="space-y-3"
      >
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How many patients have diabetes?"
            maxLength={500}
            disabled={phase === "generating" || phase === "executing"}
          />
          <Button type="submit" disabled={!question.trim() || phase === "generating" || phase === "executing"}>
            {phase === "generating" || phase === "executing" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Asking
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Ask
              </>
            )}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => submit(s.question)}
              disabled={phase === "generating" || phase === "executing"}
              className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
            >
              {s.label}
            </button>
          ))}
        </div>
      </form>

      {(sql || phase === "generating" || phase === "executing") && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Generated SQL
              {phase === "generating" && (
                <Badge variant="secondary" className="ml-2">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> streaming
                </Badge>
              )}
            </CardTitle>
            {explanation && (
              <p className="text-xs text-muted-foreground">{explanation}</p>
            )}
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
              <code>{sql || " "}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Something went wrong</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <ResultView
          columns={result.columns}
          rows={result.rows}
          chart={result.chart}
          truncated={result.truncated}
        />
      )}
    </div>
  );
}
