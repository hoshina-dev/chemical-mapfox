import "server-only";

import type { AnswerValue, ExperimentTemplate } from "@repo/forms";

import {
  getExperiment,
  updateExperiment,
} from "@/lib/experiment-manager/client";
import {
  experimentDetailToState,
  templateToExperimentUpdate,
} from "@/lib/experiment-manager/mappers";
import { getRedis } from "@/lib/redis/client";

import type { LockMap, PresenceEntry, ServerMessage } from "./events";

// --- Key helpers (see plan "Redis model") ---
const kTemplate = (ctx: string) => `template:${ctx}`;
const kValues = (ctx: string) => `values:${ctx}`;
const kDirty = (ctx: string) => `dirty:${ctx}`;
const kFlushLock = (ctx: string) => `flush:${ctx}`;
const kLock = (ctx: string, field: string) => `lock:${ctx}:${field}`;
const kPresence = (ctx: string, connectionId: string) =>
  `presence:${ctx}:${connectionId}`;
export const channel = (ctx: string) => `room:${ctx}`;

const ROOM_TTL_S = 60 * 60; // template/values buffer expiry
const LOCK_TTL_MS = 15_000;
const PRESENCE_TTL_S = 30;
const FLUSH_DEBOUNCE_MS = 10_000;

// --- Hydration: seed the live buffer from experiment-manager once per room ---

/**
 * Ensure `template:{ctx}` + `values:{ctx}` exist in Redis, seeding them from
 * experiment-manager on first access. Idempotent — a no-op once seeded.
 * Throws if the EM context can't be loaded (e.g. 404 / unreachable).
 */
export async function hydrate(ctx: string): Promise<void> {
  const redis = getRedis();
  if (await redis.exists(kTemplate(ctx))) return;

  const detail = await getExperiment(ctx);
  const state = experimentDetailToState(detail);

  const multi = redis.multi();
  multi.set(kTemplate(ctx), JSON.stringify(state.template), "EX", ROOM_TTL_S, "NX");
  const entries = Object.entries(state.values).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length > 0) {
    multi.hset(
      kValues(ctx),
      Object.fromEntries(entries.map(([k, v]) => [k, JSON.stringify(v)])),
    );
    multi.expire(kValues(ctx), ROOM_TTL_S);
  }
  await multi.exec();
}

async function readTemplate(ctx: string): Promise<ExperimentTemplate | null> {
  const raw = await getRedis().get(kTemplate(ctx));
  return raw ? (JSON.parse(raw) as ExperimentTemplate) : null;
}

export async function readValues(
  ctx: string,
): Promise<Record<string, AnswerValue>> {
  const raw = await getRedis().hgetall(kValues(ctx));
  const out: Record<string, AnswerValue> = {};
  for (const [field, json] of Object.entries(raw)) {
    out[field] = JSON.parse(json) as AnswerValue;
  }
  return out;
}

// --- Edits + persistence ---

/** Write a single field into the live buffer and mark the room dirty. */
export async function applyEdit(
  ctx: string,
  field: string,
  value: AnswerValue,
): Promise<void> {
  const redis = getRedis();
  if (value === undefined || value === null) {
    await redis.hdel(kValues(ctx), field);
  } else {
    await redis.hset(kValues(ctx), field, JSON.stringify(value));
  }
  await redis.set(kDirty(ctx), "1");
}

/**
 * Persist the buffer to experiment-manager. Single-flight across pods via a
 * short NX lock so two pods never PUT concurrently. Returns true if it flushed.
 */
export async function flushNow(ctx: string): Promise<boolean> {
  const redis = getRedis();
  const got = await redis.set(kFlushLock(ctx), "1", "EX", 12, "NX");
  if (got !== "OK") return false;
  try {
    if (!(await redis.get(kDirty(ctx)))) return false;
    const template = await readTemplate(ctx);
    if (!template) return false;
    const values = await readValues(ctx);
    await updateExperiment(ctx, templateToExperimentUpdate(template, values));
    await redis.del(kDirty(ctx));
    return true;
  } finally {
    await redis.del(kFlushLock(ctx));
  }
}

/**
 * Persist the buffer to experiment-manager unconditionally (ignores the dirty
 * flag and the debounce). Used by the submit action so the final values are
 * guaranteed flushed before the status transition. Requires the room to be
 * hydrated first.
 */
export async function persistNow(ctx: string): Promise<void> {
  const template = await readTemplate(ctx);
  if (!template) throw new Error(`room ${ctx} is not hydrated`);
  const values = await readValues(ctx);
  await updateExperiment(ctx, templateToExperimentUpdate(template, values));
  await getRedis().del(kDirty(ctx));
}

// Per-pod debounce timers. The self-hosted Node process is long-lived, so a
// module-level Map is a safe place to hold them.
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Debounced flush — resets on every edit; coalesces a burst into one PUT. */
export function scheduleFlush(ctx: string): void {
  const existing = flushTimers.get(ctx);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    flushTimers.delete(ctx);
    void flushNow(ctx).catch((err) =>
      console.error(`[collab] flush ${ctx} failed`, err),
    );
  }, FLUSH_DEBOUNCE_MS);
  if (typeof timer.unref === "function") timer.unref();
  flushTimers.set(ctx, timer);
}

// --- Soft field locks (owned by a connectionId, not a userId) ---

export async function acquireLock(
  ctx: string,
  field: string,
  connectionId: string,
): Promise<{ ok: boolean; owner: string }> {
  const redis = getRedis();
  const key = kLock(ctx, field);
  const res = await redis.set(key, connectionId, "PX", LOCK_TTL_MS, "NX");
  if (res === "OK") return { ok: true, owner: connectionId };
  const owner = (await redis.get(key)) ?? "";
  if (owner === connectionId) {
    await redis.pexpire(key, LOCK_TTL_MS);
    return { ok: true, owner };
  }
  return { ok: false, owner };
}

// Owner-checked extend / release (atomic compare-then-act via Lua).
const REFRESH_LUA =
  'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("PEXPIRE", KEYS[1], ARGV[2]) else return 0 end';
const RELEASE_LUA =
  'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';

export async function refreshLock(
  ctx: string,
  field: string,
  connectionId: string,
): Promise<boolean> {
  const res = (await getRedis().eval(
    REFRESH_LUA,
    1,
    kLock(ctx, field),
    connectionId,
    String(LOCK_TTL_MS),
  )) as number;
  return res === 1;
}

export async function releaseLock(
  ctx: string,
  field: string,
  connectionId: string,
): Promise<boolean> {
  const res = (await getRedis().eval(
    RELEASE_LUA,
    1,
    kLock(ctx, field),
    connectionId,
  )) as number;
  return res === 1;
}

// --- Presence ---

export async function setPresence(
  ctx: string,
  entry: PresenceEntry,
): Promise<void> {
  await getRedis().set(
    kPresence(ctx, entry.connectionId),
    JSON.stringify(entry),
    "EX",
    PRESENCE_TTL_S,
  );
}

export async function dropPresence(
  ctx: string,
  connectionId: string,
): Promise<void> {
  await getRedis().del(kPresence(ctx, connectionId));
}

// --- Reads / snapshot ---

async function scanKeys(pattern: string): Promise<string[]> {
  const redis = getRedis();
  const out: string[] = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    out.push(...batch);
    cursor = next;
  } while (cursor !== "0");
  return out;
}

export async function readLocks(ctx: string): Promise<LockMap> {
  const prefix = `lock:${ctx}:`;
  const keys = await scanKeys(`${prefix}*`);
  if (keys.length === 0) return {};
  const owners = await getRedis().mget(...keys);
  const map: LockMap = {};
  keys.forEach((key, i) => {
    const owner = owners[i];
    if (owner) map[key.slice(prefix.length)] = owner;
  });
  return map;
}

export async function readPresence(ctx: string): Promise<PresenceEntry[]> {
  const keys = await scanKeys(`presence:${ctx}:*`);
  if (keys.length === 0) return [];
  const raw = await getRedis().mget(...keys);
  return raw
    .filter((v): v is string => v !== null)
    .map((v) => JSON.parse(v) as PresenceEntry);
}

export async function getSnapshot(ctx: string): Promise<{
  values: Record<string, AnswerValue>;
  presence: PresenceEntry[];
  locks: LockMap;
}> {
  const [values, presence, locks] = await Promise.all([
    readValues(ctx),
    readPresence(ctx),
    readLocks(ctx),
  ]);
  return { values, presence, locks };
}

// --- Pub/sub ---

export async function publish(
  ctx: string,
  message: ServerMessage,
): Promise<void> {
  await getRedis().publish(channel(ctx), JSON.stringify(message));
}

/**
 * Clean up after a connection drops (tab closed / navigated away / network
 * loss): release every lock it held — broadcasting an `unlock` for each so
 * other clients free the field immediately — then drop its presence and
 * rebroadcast presence. Without this, a lock would linger until its TTL and
 * other clients would never receive the unlock (stuck "locked, nobody editing").
 */
export async function handleDisconnect(
  ctx: string,
  connectionId: string,
): Promise<void> {
  const locks = await readLocks(ctx);
  const freed: string[] = [];
  for (const [field, owner] of Object.entries(locks)) {
    if (owner === connectionId && (await releaseLock(ctx, field, connectionId))) {
      freed.push(field);
    }
  }
  await dropPresence(ctx, connectionId);
  for (const field of freed) {
    await publish(ctx, { type: "unlock", field });
  }
  await publish(ctx, { type: "presence", presence: await readPresence(ctx) });
}
