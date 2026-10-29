import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/auth/constants";
import { getSession } from "@/lib/auth/dal";
import { resolveSession } from "@/lib/auth/sessionStore";
import type { ServerMessage } from "@/lib/collab/events";
import { getSnapshot, handleDisconnect, hydrate } from "@/lib/collab/room";
import { addWriter } from "@/lib/collab/sse-hub";
import { logHandledError } from "@/lib/log/handled";

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
    logHandledError(err, { op: "collab.hydrate", contextId });
    return new Response("experiment unavailable", { status: 502 });
  }

  // The heartbeat runs outside the request scope, so keep the token to re-check
  // the session with: a revoked or demoted staff session loses the stream.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const encoder = new TextEncoder();
  let removeWriter: (() => Promise<void>) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const teardown = async () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (removeWriter) await removeWriter();
    // release this connection's locks + presence and tell everyone else
    await handleDisconnect(contextId, connectionId);
  };

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

      heartbeat = setInterval(async () => {
        send(": ping\n\n");
        const current = await resolveSession(token);
        if (current?.role === "admin") return;
        await teardown().catch((err) =>
          logHandledError(err, { op: "collab.revokedDisconnect", contextId }),
        );
        try {
          controller.close();
        } catch {
          // already closed
        }
      }, 25_000);
      if (typeof heartbeat.unref === "function") heartbeat.unref();
    },
    async cancel() {
      await teardown();
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
