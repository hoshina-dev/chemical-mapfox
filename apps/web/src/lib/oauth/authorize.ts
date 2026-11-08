import "server-only";

import { mcpResourceUrl } from "./metadata";
import { isValidCodeChallenge } from "./pkce";
import { getClient, OAUTH_SCOPE, type OAuthClient } from "./store";

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  scope: string;
  resource: string | null;
}

export type AuthorizeValidation =
  | { ok: true; params: AuthorizeParams; client: OAuthClient }
  /** Unknown client or unregistered redirect: never redirect, show an error. */
  | { ok: false; kind: "invalidClient" }
  /** Anything else is reported back to the (verified) redirect URI. */
  | { ok: false; kind: "redirect"; url: string };

export type RawAuthorizeParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function authorizeRedirectUrl(
  redirectUri: string,
  params: Record<string, string | null>,
): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null) url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Validates an authorization request. Re-run on consent submission, since the
 * hidden form fields are as untrusted as the original query string.
 */
export async function validateAuthorizeRequest(
  raw: RawAuthorizeParams,
  origin: string,
): Promise<AuthorizeValidation> {
  const clientId = first(raw.client_id);
  const redirectUri = first(raw.redirect_uri);
  const client = clientId ? await getClient(clientId) : null;
  if (!client || !redirectUri || !client.redirectUris.includes(redirectUri)) {
    return { ok: false, kind: "invalidClient" };
  }

  const state = first(raw.state) ?? null;
  const fail = (error: string, description: string): AuthorizeValidation => ({
    ok: false,
    kind: "redirect",
    url: authorizeRedirectUrl(redirectUri, {
      error,
      error_description: description,
      state,
    }),
  });

  if (first(raw.response_type) !== "code") {
    return fail("unsupported_response_type", "Only response_type=code is supported.");
  }
  const codeChallenge = first(raw.code_challenge);
  if (
    !codeChallenge ||
    first(raw.code_challenge_method) !== "S256" ||
    !isValidCodeChallenge(codeChallenge)
  ) {
    return fail("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  }
  const scope = first(raw.scope)?.trim() || OAUTH_SCOPE;
  if (scope.split(/\s+/).some((s) => s !== OAUTH_SCOPE)) {
    return fail("invalid_scope", `The only supported scope is "${OAUTH_SCOPE}".`);
  }
  const resource = first(raw.resource) ?? null;
  if (resource !== null && resource !== mcpResourceUrl(origin)) {
    return fail("invalid_target", "Unknown resource.");
  }

  return {
    ok: true,
    client,
    params: { clientId: client.clientId, redirectUri, codeChallenge, state, scope, resource },
  };
}
