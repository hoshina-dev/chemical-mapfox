import { OAUTH_SCOPE } from "./store";

export const MCP_PATH = "/api/mcp";
export const PROTECTED_RESOURCE_METADATA_PATH =
  "/.well-known/oauth-protected-resource";

export function mcpResourceUrl(origin: string): string {
  return `${origin}${MCP_PATH}`;
}

/** RFC 9728, path-suffixed form: `/.well-known/oauth-protected-resource/api/mcp`. */
export function protectedResourceMetadataUrl(origin: string): string {
  return `${origin}${PROTECTED_RESOURCE_METADATA_PATH}${MCP_PATH}`;
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: mcpResourceUrl(origin),
    authorization_servers: [origin],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
  };
}

/** RFC 8414. Public clients only, PKCE S256 mandatory. */
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [OAUTH_SCOPE],
  };
}
