import { getRequestOrigin } from "@/lib/http/origin";
import { oauthJson, preflight } from "@/lib/oauth/http";
import { authorizationServerMetadata } from "@/lib/oauth/metadata";

export const dynamic = "force-dynamic";

export async function GET() {
  return oauthJson(authorizationServerMetadata(await getRequestOrigin()));
}

export function OPTIONS() {
  return preflight();
}
