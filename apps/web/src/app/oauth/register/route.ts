import { z } from "zod";

import { clientIp } from "@/lib/http/clientIp";
import { logger } from "@/lib/log/logger";
import { oauthError, oauthJson, preflight } from "@/lib/oauth/http";
import { isAllowedRedirectUri } from "@/lib/oauth/redirect";
import { registerClient } from "@/lib/oauth/store";
import { getRedis } from "@/lib/redis/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Anthropic and OpenAI register from shared egress IPs, so this only caps abuse.
const MAX_REGISTRATIONS_PER_IP = 100;
const WINDOW_S = 60 * 60;

const RegistrationRequest = z.object({
  redirect_uris: z.array(z.string().max(2000)).min(1).max(10),
  client_name: z.string().trim().max(100).optional(),
});

/** RFC 7591 dynamic client registration, public clients only. */
export async function POST(request: Request) {
  const key = `oauth:register:${await clientIp()}`;
  const count = await getRedis().incr(key);
  if (count === 1) await getRedis().expire(key, WINDOW_S);
  if (count > MAX_REGISTRATIONS_PER_IP) {
    return oauthError("invalid_request", "Too many registrations.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return oauthError("invalid_client_metadata", "Body must be JSON.");
  }
  const parsed = RegistrationRequest.safeParse(body);
  if (!parsed.success) {
    return oauthError("invalid_client_metadata", "redirect_uris is required.");
  }
  const { redirect_uris: redirectUris, client_name: clientName } = parsed.data;
  if (!redirectUris.every(isAllowedRedirectUri)) {
    return oauthError(
      "invalid_redirect_uri",
      "Redirect URIs must use HTTPS (or HTTP on localhost) and have no fragment.",
    );
  }

  const client = await registerClient({
    clientName: clientName || "MCP client",
    redirectUris,
  });
  logger.info(
    { op: "oauth.register", clientId: client.clientId, clientName: client.clientName, redirectUris },
    "oauth client registered",
  );

  // A client asking for a secret-based method still gets a public client: the
  // response states what was actually registered, as RFC 7591 allows.
  return oauthJson(
    {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.createdAt / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201,
  );
}

export function OPTIONS() {
  return preflight();
}
