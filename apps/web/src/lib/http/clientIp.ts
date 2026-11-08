import "server-only";

import { headers } from "next/headers";

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Behind Cloudflare; cf-connecting-ip is set by the edge, not the client.
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
