import { getRequestOrigin } from "@/lib/http/origin";
import { oauthJson, preflight } from "@/lib/oauth/http";
import { protectedResourceMetadata } from "@/lib/oauth/metadata";

export const dynamic = "force-dynamic";

// Served both bare and path-suffixed (`…/api/mcp`); clients try either.
export async function GET() {
  return oauthJson(protectedResourceMetadata(await getRequestOrigin()));
}

export function OPTIONS() {
  return preflight();
}
