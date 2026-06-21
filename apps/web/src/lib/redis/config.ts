import "server-only";

/**
 * Connection string for the shared Redis used by the collaborative editing
 * layer (presence, soft field locks, the live value buffer, and pub/sub
 * fan-out). Mirrors the other backend config modules
 * (`lib/ticketing/config.ts`, `lib/experiment-manager/config.ts`).
 */
export function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return url;
}
