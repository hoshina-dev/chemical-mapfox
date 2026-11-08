import {
  oauthError,
  oauthJson,
  preflight,
  readParams,
} from "@/lib/oauth/http";
import { verifyPkce } from "@/lib/oauth/pkce";
import {
  consumeAuthCode,
  getClient,
  issueGrant,
  refreshGrant,
  type TokenSet,
} from "@/lib/oauth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenResponse(tokens: TokenSet): Response {
  return oauthJson({
    access_token: tokens.accessToken,
    token_type: "Bearer",
    expires_in: tokens.expiresIn,
    refresh_token: tokens.refreshToken,
    scope: tokens.scope,
  });
}

export async function POST(request: Request) {
  const params = await readParams(request);
  if (!params) return oauthError("invalid_request", "Unreadable request body.");

  const clientId = params.client_id;
  if (!clientId) return oauthError("invalid_client", "client_id is required.", 401);
  const client = await getClient(clientId);
  if (!client) return oauthError("invalid_client", "Unknown client.", 401);

  switch (params.grant_type) {
    case "authorization_code": {
      const { code, redirect_uri: redirectUri, code_verifier: verifier } = params;
      if (!code || !redirectUri || !verifier) {
        return oauthError(
          "invalid_request",
          "code, redirect_uri and code_verifier are required.",
        );
      }
      // Consumed before validation, so a failed attempt still burns the code.
      const record = await consumeAuthCode(code);
      if (
        !record ||
        record.clientId !== clientId ||
        record.redirectUri !== redirectUri ||
        !verifyPkce(verifier, record.codeChallenge) ||
        (params.resource !== undefined &&
          record.resource !== null &&
          params.resource !== record.resource)
      ) {
        return oauthError("invalid_grant", "Invalid or expired authorization code.");
      }
      return tokenResponse(await issueGrant(record, client));
    }
    case "refresh_token": {
      if (!params.refresh_token) {
        return oauthError("invalid_request", "refresh_token is required.");
      }
      const tokens = await refreshGrant(clientId, params.refresh_token);
      if (!tokens) {
        return oauthError("invalid_grant", "Invalid or expired refresh token.");
      }
      return tokenResponse(tokens);
    }
    default:
      return oauthError(
        "unsupported_grant_type",
        "Only authorization_code and refresh_token are supported.",
      );
  }
}

export function OPTIONS() {
  return preflight();
}
