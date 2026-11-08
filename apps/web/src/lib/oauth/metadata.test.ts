import { describe, expect, it } from "vitest";

import {
  authorizationServerMetadata,
  MCP_PATH,
  mcpResourceUrl,
  PROTECTED_RESOURCE_METADATA_PATH,
  protectedResourceMetadata,
  protectedResourceMetadataUrl,
} from "./metadata";
import { OAUTH_SCOPE } from "./store";

const origin = "https://lab.example";

describe("mcp resource URLs", () => {
  it("builds the resource and path-suffixed metadata URLs", () => {
    expect(MCP_PATH).toBe("/api/mcp");
    expect(PROTECTED_RESOURCE_METADATA_PATH).toBe(
      "/.well-known/oauth-protected-resource",
    );
    expect(mcpResourceUrl(origin)).toBe("https://lab.example/api/mcp");
    expect(protectedResourceMetadataUrl(origin)).toBe(
      "https://lab.example/.well-known/oauth-protected-resource/api/mcp",
    );
  });
});

describe("protectedResourceMetadata", () => {
  it("advertises this origin as the authorization server for /api/mcp", () => {
    expect(protectedResourceMetadata(origin)).toEqual({
      resource: "https://lab.example/api/mcp",
      authorization_servers: [origin],
      scopes_supported: [OAUTH_SCOPE],
      bearer_methods_supported: ["header"],
    });
  });
});

describe("authorizationServerMetadata", () => {
  it("describes a public-client, PKCE S256 authorization server", () => {
    expect(authorizationServerMetadata(origin)).toEqual({
      issuer: origin,
      authorization_endpoint: "https://lab.example/oauth/authorize",
      token_endpoint: "https://lab.example/oauth/token",
      registration_endpoint: "https://lab.example/oauth/register",
      revocation_endpoint: "https://lab.example/oauth/revoke",
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      revocation_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [OAUTH_SCOPE],
    });
  });
});
