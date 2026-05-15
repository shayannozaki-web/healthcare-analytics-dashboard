import { NextRequest } from "next/server";

import { isSeeded, rowCounts, seed, type SeedProgress } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Pro caps at 300s. Hobby caps at 60s — the seed may need a re-click on Hobby to finish.

function encode(payload: SeedProgress | { kind: "error"; message: string } | { kind: "start" }): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(_req: NextRequest) {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (p: SeedProgress | { kind: "error"; message: string } | { kind: "start" }) =>
        controller.enqueue(encode(p));
      try {
        send({ kind: "start" });
        await seed(send);
      } catch (err) {
        send({ kind: "error", message: (err as Error).message ?? "Unknown error" });
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

export async function GET() {
  const seeded = await isSeeded();
  const counts = await rowCounts();
  return Response.json({ seeded, counts });
}
