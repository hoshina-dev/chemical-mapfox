import "server-only";

import { getSubscriber } from "@/lib/redis/client";

import { channel } from "./room";

/**
 * Per-pod fan-out from Redis pub/sub to the SSE connections held on this pod.
 *
 * One shared Redis subscriber listens on every `room:{ctx}` channel that has at
 * least one local connection, and dispatches each message to that room's
 * writers. This is the only per-pod binding; it holds no authoritative state
 * (that's all in Redis), and is rebuilt as clients (re)connect — so a pod can
 * die and its clients just reconnect elsewhere.
 */
type Writer = (message: string) => void;

declare global {
  var __chemfoxSse:
    | { rooms: Map<string, Set<Writer>>; wired: boolean }
    | undefined;
}

const hub = (globalThis.__chemfoxSse ??= { rooms: new Map(), wired: false });

function ensureWired(): void {
  if (hub.wired) return;
  hub.wired = true;
  getSubscriber().on("message", (chan: string, message: string) => {
    const writers = hub.rooms.get(chan);
    if (!writers) return;
    for (const write of writers) write(message);
  });
}

/**
 * Register an SSE writer for a context. Subscribes to the Redis channel on the
 * first writer and unsubscribes when the last one leaves. Returns a disposer.
 */
export async function addWriter(
  contextId: string,
  write: Writer,
): Promise<() => Promise<void>> {
  ensureWired();
  const chan = channel(contextId);
  let writers = hub.rooms.get(chan);
  if (!writers) {
    writers = new Set();
    hub.rooms.set(chan, writers);
    await getSubscriber().subscribe(chan);
  }
  writers.add(write);

  return async () => {
    const set = hub.rooms.get(chan);
    if (!set) return;
    set.delete(write);
    if (set.size === 0) {
      hub.rooms.delete(chan);
      await getSubscriber().unsubscribe(chan);
    }
  };
}
