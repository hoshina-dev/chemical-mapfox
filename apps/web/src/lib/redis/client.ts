import "server-only";

import Redis from "ioredis";

import { getRedisUrl } from "./config";

/**
 * Process-wide Redis connections. We keep at most two per pod:
 *  - `client`     — normal commands (GET/SET/HSET/PUBLISH/…).
 *  - `subscriber` — a *dedicated* connection for SUBSCRIBE; a connection in
 *    subscriber mode can't run normal commands, so pub/sub needs its own.
 *
 * Cached on `globalThis` so Next's dev HMR doesn't open a new pair on every
 * reload. The connection holds no authoritative state — all shared state lives
 * in Redis keys — so a pod restart is harmless.
 */
declare global {
  var __chemfoxRedis: { client?: Redis; subscriber?: Redis } | undefined;
}

const store = (globalThis.__chemfoxRedis ??= {});

function create(): Redis {
  const redis = new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    lazyConnect: false,
  });
  redis.on("error", (err) => {
    console.error("[redis] connection error", err);
  });
  return redis;
}

export function getRedis(): Redis {
  return (store.client ??= create());
}

export function getSubscriber(): Redis {
  return (store.subscriber ??= create());
}
