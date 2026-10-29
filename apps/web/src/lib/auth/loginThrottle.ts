import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { getRedis } from "@/lib/redis/client";

/**
 * Failed-password counters in Redis, per account and per client IP. Every
 * guess reaches custapi from the BFF's own address, so custapi can't throttle
 * by IP itself; this is the only place that sees the real client.
 */

const WINDOW_S = 15 * 60;
const MAX_FAILURES_PER_ACCOUNT = 10;
const MAX_FAILURES_PER_IP = 50;

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

async function clientIp(): Promise<string> {
  const h = await headers();
  // Behind Cloudflare; cf-connecting-ip is set by the edge, not the client.
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

async function keys(email: string): Promise<[string, string]> {
  return [
    `login-fail:acct:${hash(email.trim().toLowerCase())}`,
    `login-fail:ip:${hash(await clientIp())}`,
  ];
}

export async function isLoginThrottled(email: string): Promise<boolean> {
  const [acctKey, ipKey] = await keys(email);
  const [acct, ip] = await getRedis().mget(acctKey, ipKey);
  return (
    Number(acct ?? 0) >= MAX_FAILURES_PER_ACCOUNT ||
    Number(ip ?? 0) >= MAX_FAILURES_PER_IP
  );
}

export async function recordLoginFailure(email: string): Promise<void> {
  const [acctKey, ipKey] = await keys(email);
  // EXPIRE NX keeps a fixed window instead of extending it on every guess.
  await getRedis()
    .multi()
    .incr(acctKey)
    .expire(acctKey, WINDOW_S, "NX")
    .incr(ipKey)
    .expire(ipKey, WINDOW_S, "NX")
    .exec();
}

export async function clearLoginFailures(email: string): Promise<void> {
  const [acctKey] = await keys(email);
  await getRedis().del(acctKey);
}
