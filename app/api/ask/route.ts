import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

import { SYSTEM_PROMPT } from "@/lib/ask-schema";
import { detectChartShape } from "@/lib/result-shape";
import { runSelect } from "@/lib/sql-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";

const TOOL = {
  name: "submit_query",
  description: "Submit the single SQL SELECT query that answers the user's question.",
  input_schema: {
    type: "object",
    required: ["sql", "result_type", "explanation"],
    properties: {
      sql: { type: "string", description: "A single SQLite SELECT statement." },
      result_type: {
        type: "string",
        enum: ["table", "chart"],
        description: "How the result should be presented.",
      },
      chart_type: {
        type: ["string", "null"],
        enum: ["line", "bar", null],
        description: "Preferred chart type, or null for table results.",
      },
      explanation: {
        type: "string",
        description: "One-sentence plain-English explanation of what the query does.",
      },
    },
  },
} as const;

type EventPayload =
  | { event: "start" }
  | { event: "sql_delta"; text: string }
  | { event: "meta"; resultType: "table" | "chart"; chartType: "line" | "bar" | null; explanation: string; sql: string }
  | {
      event: "result";
      columns: string[];
      rows: Array<Record<string, unknown>>;
      truncated: boolean;
      chart: ReturnType<typeof detectChartShape>;
    }
  | { event: "error"; message: string };

function encode(payload: EventPayload): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(req: NextRequest) {
  let body: { question?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }
  const question = (body.question ?? "").trim();
  if (!question) {
    return new Response(JSON.stringify({ error: "question is required" }), { status: 400 });
  }
  if (question.length > 500) {
    return new Response(JSON.stringify({ error: "question too long (max 500 chars)" }), {
      status: 400,
    });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured on the server." }),
      { status: 500 },
    );
  }

  const client = new Anthropic();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: EventPayload) => controller.enqueue(encode(payload));

      try {
        send({ event: "start" });

        const llm = client.messages.stream({
          model: MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: [TOOL],
          tool_choice: { type: "tool", name: "submit_query" },
          messages: [{ role: "user", content: question }],
        });

        let partialJson = "";
        let sqlEmitted = "";

        llm.on("inputJson", (_partialJson, _completedJson) => {
          // no-op; we handle deltas below to avoid double-handling.
        });

        for await (const event of llm) {
          if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
            partialJson += event.delta.partial_json;
            // Best-effort partial extraction of the sql field so we can stream it.
            const extracted = extractPartialString(partialJson, "sql");
            if (extracted != null && extracted.length > sqlEmitted.length) {
              const delta = extracted.slice(sqlEmitted.length);
              sqlEmitted = extracted;
              send({ event: "sql_delta", text: delta });
            }
          }
        }

        const final = await llm.finalMessage();
        const toolUse = final.content.find((c) => c.type === "tool_use");
        if (!toolUse || toolUse.type !== "tool_use") {
          throw new Error("Model did not return a tool call.");
        }
        const input = toolUse.input as {
          sql: string;
          result_type: "table" | "chart";
          chart_type: "line" | "bar" | null;
          explanation: string;
        };

        // If we never emitted any sql_delta (partial parsing missed a fast stream), flush it now.
        if (sqlEmitted.length === 0 && input.sql) {
          send({ event: "sql_delta", text: input.sql });
        } else if (input.sql.length > sqlEmitted.length) {
          send({ event: "sql_delta", text: input.sql.slice(sqlEmitted.length) });
        }

        send({
          event: "meta",
          resultType: input.result_type,
          chartType: input.chart_type ?? null,
          explanation: input.explanation,
          sql: input.sql,
        });

        let result;
        try {
          result = await runSelect(input.sql);
        } catch (err) {
          send({
            event: "error",
            message: `Could not execute that SQL: ${(err as Error).message}`,
          });
          controller.close();
          return;
        }

        const chart =
          input.result_type === "chart"
            ? detectChartShape(result, input.chart_type)
            : { kind: "none" as const };
        send({
          event: "result",
          columns: result.columns,
          rows: result.rows,
          truncated: result.truncated,
          chart,
        });
      } catch (err) {
        send({ event: "error", message: (err as Error).message ?? "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * Pull a string-valued field out of an in-progress JSON document. Returns the
 * decoded string contents up to the (current) end of the value.
 */
function extractPartialString(buffer: string, key: string): string | null {
  const re = new RegExp(`"${key}"\\s*:\\s*"`);
  const m = re.exec(buffer);
  if (!m) return null;
  let i = m.index + m[0].length;
  let out = "";
  while (i < buffer.length) {
    const ch = buffer[i];
    if (ch === "\\") {
      const next = buffer[i + 1];
      if (next == null) break; // partial escape, wait for more
      if (next === "n") out += "\n";
      else if (next === "t") out += "\t";
      else if (next === "r") out += "\r";
      else if (next === '"') out += '"';
      else if (next === "\\") out += "\\";
      else if (next === "/") out += "/";
      else if (next === "u") {
        if (i + 6 > buffer.length) break;
        out += String.fromCharCode(parseInt(buffer.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      } else out += next;
      i += 2;
      continue;
    }
    if (ch === '"') break; // end of string
    out += ch;
    i += 1;
  }
  return out;
}
