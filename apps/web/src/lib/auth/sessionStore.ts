import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { usersApi } from "@/lib/custapi/client";
import { logHandledError } from "@/lib/log/handled";
import { httpStatus } from "@/lib/log/serialize";
import { getRedis } from "@/lib/redis/client";

import { SESSION_DURATION_MS } from "./constants";
import type { CustApiRole, SessionPayload } from "./definitions";

/**
 * Server-side sessions in Redis. The cookie carries only a random token; Redis
 * keys use its SHA-256 so a Redis dump holds no usable cookies.
 * Design: docs/sessions.md.
 */

const IDLE_TTL_S = SESSION_DURATION_MS / 1000;
export const ABSOLUTE_MAX_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
/** Longest a role revoked in custapi keeps working here. */
export const ROLE_CHECK_INTERVAL_MS = 60 * 1000;
/** How long a stored role is trusted while custapi is unreachable. */
export const ROLE_STALE_MAX_MS = 60 * 60 * 1000;

export interface SessionUserInput {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: CustApiRole;
  organizationId?: string;
}

interface StoredSession extends SessionPayload {
  createdAt: number;
  lastSeenAt: number;
  roleCheckedAt: number;
}

const sessionKey = (hash: string) => `session:${hash}`;
const userSessionsKey = (userId: string) => `user:${userId}:sessions`;
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

function toPayload(stored: StoredSession): SessionPayload {
  return {
    userId: stored.userId,
    name: stored.name,
    email: stored.email,
    avatarUrl: stored.avatarUrl,
    role: stored.role,
    organizationId: stored.organizationId,
  };
}

/** Creates a session and returns the token for the cookie. */
export async function createSessionRecord(
  user: SessionUserInput,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hash = hashToken(token);
  const now = Date.now();
  const stored: StoredSession = {
    userId: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    organizationId: user.organizationId,
    createdAt: now,
    lastSeenAt: now,
    roleCheckedAt: now,
  };
  await getRedis()
    .multi()
    .set(sessionKey(hash), JSON.stringify(stored), "EX", IDLE_TTL_S)
    .sadd(userSessionsKey(user.id), hash)
    .expire(userSessionsKey(user.id), IDLE_TTL_S)
    .exec();
  return token;
}

/**
 * Re-reads role and profile from custapi. Returns null when the session must
 * not be honoured: the user is gone, or custapi has been down too long.
 */
async function revalidate(
  stored: StoredSession,
  now: number,
): Promise<StoredSession | null> {
  try {
    const user = await usersApi.usersIdIdGet(stored.userId);
    return {
      ...stored,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role as CustApiRole,
      roleCheckedAt: now,
    };
  } catch (error) {
    const status = httpStatus(error);
    if (status === 404) {
      await revokeUserSessions(stored.userId);
      return null;
    }
    logHandledError(error, {
      op: "session.revalidate",
      service: "custapi",
      userId: stored.userId,
      status,
    });
    return now - stored.roleCheckedAt > ROLE_STALE_MAX_MS ? null : stored;
  }
}

async function resolve(token: string): Promise<SessionPayload | null> {
  const hash = hashToken(token);
  const raw = await getRedis().get(sessionKey(hash));
  if (!raw) return null;

  let stored = JSON.parse(raw) as StoredSession;
  const now = Date.now();
  if (now - stored.createdAt > ABSOLUTE_MAX_MS) {
    await removeSession(hash, stored.userId);
    return null;
  }

  let dirty = false;
  if (now - stored.roleCheckedAt > ROLE_CHECK_INTERVAL_MS) {
    const fresh = await revalidate(stored, now);
    if (!fresh) return null;
    dirty = fresh !== stored;
    stored = fresh;
  }
  if (dirty || now - stored.lastSeenAt > TOUCH_INTERVAL_MS) {
    stored = { ...stored, lastSeenAt: now };
    // XX: never resurrect a session revoked while this request was in flight.
    await getRedis().set(
      sessionKey(hash),
      JSON.stringify(stored),
      "EX",
      IDLE_TTL_S,
      "XX",
    );
    await getRedis().expire(userSessionsKey(stored.userId), IDLE_TTL_S);
  }
  return toPayload(stored);
}

/**
 * Looks up the session for a cookie token. Fails closed: a Redis error is
 * logged and treated as signed out.
 */
export async function resolveSession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    return await resolve(token);
  } catch (error) {
    logHandledError(error, { op: "session.resolve", service: "redis" });
    return null;
  }
}

async function removeSession(hash: string, userId: string): Promise<void> {
  await getRedis()
    .multi()
    .del(sessionKey(hash))
    .srem(userSessionsKey(userId), hash)
    .exec();
}

export async function destroySession(token: string): Promise<void> {
  const hash = hashToken(token);
  const raw = await getRedis().get(sessionKey(hash));
  if (!raw) return;
  await removeSession(hash, (JSON.parse(raw) as StoredSession).userId);
}

/** Signs the user out everywhere. */
export async function revokeUserSessions(userId: string): Promise<void> {
  const redis = getRedis();
  const hashes = await redis.smembers(userSessionsKey(userId));
  await redis
    .multi()
    .del(...hashes.map(sessionKey), userSessionsKey(userId))
    .exec();
}

/** Copies profile edits into every live session of the user. */
export async function updateUserSessions(
  userId: string,
  patch: Pick<SessionPayload, "name" | "email" | "avatarUrl">,
): Promise<void> {
  const redis = getRedis();
  const hashes = await redis.smembers(userSessionsKey(userId));
  for (const hash of hashes) {
    const raw = await redis.get(sessionKey(hash));
    if (!raw) {
      await redis.srem(userSessionsKey(userId), hash);
      continue;
    }
    const stored = { ...(JSON.parse(raw) as StoredSession), ...patch };
    await redis.set(sessionKey(hash), JSON.stringify(stored), "KEEPTTL", "XX");
  }
}
