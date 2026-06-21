import "server-only";

import { headers } from "next/headers";

/**
 * Absolute origin (scheme + host) of the current request, used to build
 * fully-qualified URLs such as the QR-encoded sample check-in link.
 *
 * Prefers the `APP_ORIGIN` env override; otherwise derives it from the
 * forwarded host/proto headers. The app runs behind Cloudflare, which sets
 * `x-forwarded-proto`/`x-forwarded-host`, so the derived value matches the
 * public hostname. Falls back to `http` only for localhost (local dev).
 */
export async function getRequestOrigin(): Promise<string> {
  const override = process.env.APP_ORIGIN;
  if (override) return override.replace(/\/+$/, "");

  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}
