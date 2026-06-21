import type { AnswerValue } from "@repo/forms";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/dal";
import { editorColor } from "@/lib/collab/colors";
import { ClientEvent, type PresenceEntry } from "@/lib/collab/events";
import {
  acquireLock,
  applyEdit,
  flushNow,
  hydrate,
  publish,
  readPresence,
  releaseLock,
  scheduleFlush,
  setPresence,
} from "@/lib/collab/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Client → server collaboration events for one experiment context. Soft locks
 * are advisory (UI-cooperative): the field a staff focuses is highlighted and
 * disabled for others, but the server still accepts edits last-write-wins, so
 * the repeatable-group case (locked by group id, edited by child id) just works.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ contextId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { contextId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = ClientEvent.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid event" }, { status: 400 });
  }
  const event = parsed.data;

  // connectionId comes from the client (one per tab/device); auth is the session.
  const entry: PresenceEntry = {
    connectionId: event.connectionId,
    userId: session.userId,
    name: session.name,
    avatarUrl: session.avatarUrl ?? null,
    color: editorColor(session.userId),
  };

  try {
    await hydrate(contextId);
  } catch (err) {
    console.error(`[collab] hydrate ${contextId} failed`, err);
    return NextResponse.json({ error: "experiment unavailable" }, { status: 502 });
  }

  switch (event.type) {
    case "focus": {
      await setPresence(contextId, entry);
      // Announce presence BEFORE the lock so clients already know the owner when
      // the lock arrives (they only show a lock whose owner is present).
      await publishPresence(contextId);
      const lock = await acquireLock(contextId, event.field, event.connectionId);
      if (lock.ok) {
        await publish(contextId, {
          type: "lock",
          field: event.field,
          by: event.connectionId,
        });
      }
      return NextResponse.json({
        lock: lock.ok ? "granted" : "denied",
        owner: lock.owner,
      });
    }
    case "blur": {
      const released = await releaseLock(
        contextId,
        event.field,
        event.connectionId,
      );
      if (released) {
        await publish(contextId, { type: "unlock", field: event.field });
      }
      // The user finished this field — persist promptly so EM-backed views
      // (the client's read-only page) reflect it without the 10s debounce.
      // Guarded by a single-flight lock + dirty flag inside flushNow.
      void flushNow(contextId).catch((err) =>
        console.error(`[collab] blur flush ${contextId} failed`, err),
      );
      return NextResponse.json({ ok: true });
    }
    case "edit": {
      const value = event.value as AnswerValue;
      await applyEdit(contextId, event.field, value);
      scheduleFlush(contextId);
      await publish(contextId, {
        type: "edit",
        field: event.field,
        value,
        by: event.connectionId,
      });
      return NextResponse.json({ ok: true });
    }
    case "heartbeat": {
      await setPresence(contextId, entry);
      await publishPresence(contextId);
      return NextResponse.json({ ok: true });
    }
  }
}

async function publishPresence(contextId: string): Promise<void> {
  await publish(contextId, {
    type: "presence",
    presence: await readPresence(contextId),
  });
}
