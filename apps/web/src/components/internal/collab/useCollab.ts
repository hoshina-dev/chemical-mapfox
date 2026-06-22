"use client";

import type { AnswerValue, FormAnswers } from "@repo/forms";
import { useCallback, useEffect, useRef, useState } from "react";

import type { LockMap, PresenceEntry, ServerMessage } from "@/lib/collab/events";

const EDIT_THROTTLE_MS = 80; // coalesce keystrokes; still feels live to viewers
const PRESENCE_HEARTBEAT_MS = 20_000; // refresh presence TTL (server EX 30)
const LOCK_KEEPALIVE_MS = 10_000; // re-claim the focused field's lock (server PX 15s)

/** Event shape the caller produces; `connectionId` is injected by the hook. */
type OutEvent =
  | { type: "focus"; field: string }
  | { type: "blur"; field: string }
  | { type: "edit"; field: string; value: AnswerValue }
  | { type: "heartbeat" };

export interface CollabState {
  values: FormAnswers;
  /** Per-connection presence entries (one per editing tab/device). */
  presence: PresenceEntry[];
  /** field → owning connectionId */
  locks: LockMap;
  /** This tab's connection id. */
  connectionId: string;
  connected: boolean;
  focusField: (field: string) => void;
  blurField: (field: string) => void;
  edit: (field: string, value: AnswerValue) => void;
}

/**
 * Live collaboration for one experiment context. Each mount is a distinct
 * connection (one per tab/device): it subscribes to the SSE stream, holds the
 * shared values/presence/locks, and posts focus/blur/edit/heartbeat events. The
 * browser's EventSource auto-reconnects on drop and we re-sync from `snapshot`.
 */
export function useCollab(
  contextId: string,
  initialValues: FormAnswers,
): CollabState {
  const [values, setValues] = useState<FormAnswers>(initialValues);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [locks, setLocks] = useState<LockMap>({});
  const [connected, setConnected] = useState(false);

  // One stable connection id per mount (tab/device). Lazy state init runs the
  // generator once per mount — a stable value without reading a ref in render.
  const [connectionId] = useState(() => crypto.randomUUID());

  const base = `/internal/experiment/${contextId}/collab`;

  const post = useCallback(
    (event: OutEvent) => {
      void fetch(`${base}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...event, connectionId }),
        // let a blur still send while the tab is unloading
        keepalive: event.type === "blur",
      }).catch(() => {
        // network blips are fine — presence/locks self-heal via TTL + reconnect
      });
    },
    [base, connectionId],
  );

  // --- SSE subscription ---
  useEffect(() => {
    const source = new EventSource(`${base}/stream?cid=${connectionId}`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false); // EventSource retries on its own
    source.onmessage = (e) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(e.data) as ServerMessage;
      } catch {
        return;
      }
      switch (msg.type) {
        case "snapshot":
          // The buffer is the authoritative, complete set of stored values
          // (seeded from EM, then mutated). Replace — don't merge over the
          // initial props — so a field cleared in the buffer doesn't get the
          // stale initial value re-introduced.
          setValues(msg.values);
          setPresence(msg.presence);
          setLocks(msg.locks);
          break;
        case "edit":
          // ignore the echo of *this connection's* edits; apply everyone
          // else's — including the same user's other tabs.
          if (msg.by !== connectionId) {
            setValues((prev) => ({ ...prev, [msg.field]: msg.value }));
          }
          break;
        case "lock":
          setLocks((prev) => ({ ...prev, [msg.field]: msg.by }));
          break;
        case "unlock":
          setLocks((prev) => {
            const next = { ...prev };
            delete next[msg.field];
            return next;
          });
          break;
        case "presence":
          setPresence(msg.presence);
          break;
      }
    };
    return () => source.close();
  }, [base, connectionId]);

  // --- presence heartbeat ---
  useEffect(() => {
    post({ type: "heartbeat" }); // announce immediately on mount
    const id = setInterval(() => post({ type: "heartbeat" }), PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [post]);

  // --- lock keepalive for the currently focused field ---
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      if (focusedRef.current) post({ type: "focus", field: focusedRef.current });
    }, LOCK_KEEPALIVE_MS);
    return () => clearInterval(id);
  }, [post]);

  // --- throttled edit POSTs (per field, trailing) ---
  const editTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingEdits = useRef(new Map<string, AnswerValue>());

  const flushEdit = useCallback(
    (field: string) => {
      editTimers.current.delete(field);
      if (!pendingEdits.current.has(field)) return;
      const value = pendingEdits.current.get(field) as AnswerValue;
      pendingEdits.current.delete(field);
      // Normalize a cleared value to explicit `null`: `undefined` is dropped by
      // JSON.stringify, which would send no value at all (a clear must be sent).
      post({ type: "edit", field, value: value ?? null });
    },
    [post],
  );

  const edit = useCallback(
    (field: string, value: AnswerValue) => {
      setValues((prev) => ({ ...prev, [field]: value })); // instant local echo
      pendingEdits.current.set(field, value);
      if (editTimers.current.has(field)) return; // a trailing window is already open
      editTimers.current.set(
        field,
        setTimeout(() => flushEdit(field), EDIT_THROTTLE_MS),
      );
    },
    [flushEdit],
  );

  const focusField = useCallback(
    (field: string) => {
      focusedRef.current = field;
      post({ type: "focus", field });
    },
    [post],
  );

  const blurField = useCallback(
    (field: string) => {
      if (focusedRef.current === field) focusedRef.current = null;
      // flush any pending edit before releasing the lock
      const timer = editTimers.current.get(field);
      if (timer) clearTimeout(timer);
      flushEdit(field);
      post({ type: "blur", field });
    },
    [post, flushEdit],
  );

  return {
    values,
    presence,
    locks,
    connectionId,
    connected,
    focusField,
    blurField,
    edit,
  };
}
