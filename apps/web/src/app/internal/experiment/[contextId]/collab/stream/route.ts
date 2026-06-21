import { getSession } from "@/lib/auth/dal";
import type { ServerMessage } from "@/lib/collab/events";
import { getSnapshot, handleDisconnect, hydrate } from "@/lib/collab/room";
import { addWriter } from "@/lib/collab/sse-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE stream of collaboration events for one experiment context. Pushes an
 * initial `snapshot`, then relays `edit`/`lock`/`unlock`/`presence` messages
 * published to `room:{ctx}`. A comment heartbeat every ~25s keeps the
 * connection alive through Cloudflare's ~100s idle timeout.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ contextId: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("unauthorized", { status: 401 });
  if (session.role !== "admin") return new Response("forbidden", { status: 403 });

  // One connection per tab/device; used to drop only this session's presence.
  const connectionId = new URL(request.url).searchParams.get("cid");
  if (!connectionId) return new Response("missing cid", { status: 400 });

  const { contextId } = await params;
  try {
    await hydrate(contextId);
  } catch (err) {
    console.error(`[collab] hydrate ${contextId} failed`, err);
    return new Response("experiment unavailable", { status: 502 });
  }

  const encoder = new TextEncoder();
  let removeWriter: (() => Promise<void>) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // controller already closed — ignore
        }
      };

      const snapshot: ServerMessage = {
        type: "snapshot",
        ...(await getSnapshot(contextId)),
      };
      send(`data: ${JSON.stringify(snapshot)}\n\n`);

      // The hub hands us the raw published JSON; wrap it as an SSE data frame.
      removeWriter = await addWriter(contextId, (message) =>
        send(`data: ${message}\n\n`),
      );

      heartbeat = setInterval(() => send(": ping\n\n"), 25_000);
      if (typeof heartbeat.unref === "function") heartbeat.unref();
    },
    async cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (removeWriter) await removeWriter();
      // release this connection's locks + presence and tell everyone else
      await handleDisconnect(contextId, connectionId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Belt-and-suspenders: hint proxies (nginx) not to buffer the stream.
      "X-Accel-Buffering": "no",
    },
  });
}
