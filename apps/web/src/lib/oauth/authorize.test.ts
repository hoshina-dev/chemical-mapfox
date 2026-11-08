import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis/client", async () => {
  const { default: RedisMock } = await import("ioredis-mock");
  const redis = new RedisMock();
  return { getRedis: () => redis, getSubscriber: () => redis };
});
vi.mock("@/lib/custapi/client", () => ({
  usersApi: { usersIdIdGet: vi.fn() },
}));
vi.mock("@/lib/log/handled", () => ({ logHandledError: vi.fn() }));

import { getRedis } from "@/lib/redis/client";

import { authorizeRedirectUrl, validateAuthorizeRequest } from "./authorize";
import { registerClient } from "./store";

const origin = "https://lab.example";
const resource = `${origin}/api/mcp`;
const challenge = "a".repeat(43);
const redirectUri = "https://claude.ai/api/mcp/auth_callback";

let clientId: string;

beforeEach(async () => {
  await getRedis().flushall();
  const client = await registerClient({
    clientName: "Claude",
    redirectUris: [redirectUri],
  });
  clientId = client.clientId;
});

function validRaw(overrides: Record<string, string | string[] | undefined> = {}) {
  return {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...overrides,
  };
}

function errorUrl(error: string, description: string, state?: string | null) {
  return authorizeRedirectUrl(redirectUri, {
    error,
    error_description: description,
    state: state ?? null,
  });
}

describe("authorizeRedirectUrl", () => {
  it("appends params and skips nulls", () => {
    expect(
      authorizeRedirectUrl("https://claude.ai/cb?existing=1", {
        error: "invalid_scope",
        error_description: "nope",
        state: null,
      }),
    ).toBe(
      "https://claude.ai/cb?existing=1&error=invalid_scope&error_description=nope",
    );
  });
});

describe("validateAuthorizeRequest", () => {
  it("accepts a complete PKCE S256 request and defaults the scope", async () => {
    const result = await validateAuthorizeRequest(validRaw(), origin);
    expect(result).toEqual({
      ok: true,
      client: expect.objectContaining({
        clientId,
        clientName: "Claude",
      }),
      params: {
        clientId,
        redirectUri,
        codeChallenge: challenge,
        state: null,
        scope: "staff",
        resource: null,
      },
    });
  });

  it("accepts the staff scope, a matching resource, and a state", async () => {
    const result = await validateAuthorizeRequest(
      validRaw({
        scope: " staff ",
        resource,
        state: "s1",
      }),
      origin,
    );
    expect(result).toMatchObject({
      ok: true,
      params: { scope: "staff", resource, state: "s1" },
    });
  });

  it("takes the first value of array-valued params", async () => {
    const result = await validateAuthorizeRequest(
      {
        client_id: [clientId, "other"],
        redirect_uri: [redirectUri, "https://evil.example/cb"],
        response_type: ["code", "token"],
        code_challenge: [challenge, "b".repeat(43)],
        code_challenge_method: ["S256", "plain"],
        scope: ["staff", "admin"],
        resource: [resource, "https://evil.example/api/mcp"],
        state: ["keep", "drop"],
      },
      origin,
    );
    expect(result).toMatchObject({
      ok: true,
      params: {
        clientId,
        redirectUri,
        codeChallenge: challenge,
        scope: "staff",
        resource,
        state: "keep",
      },
    });
  });

  it("returns invalidClient for an unknown client or unregistered redirect", async () => {
    expect(
      await validateAuthorizeRequest(validRaw({ client_id: "missing" }), origin),
    ).toEqual({ ok: false, kind: "invalidClient" });
    expect(
      await validateAuthorizeRequest(validRaw({ client_id: undefined }), origin),
    ).toEqual({ ok: false, kind: "invalidClient" });
    expect(
      await validateAuthorizeRequest(
        validRaw({ redirect_uri: "https://evil.example/cb" }),
        origin,
      ),
    ).toEqual({ ok: false, kind: "invalidClient" });
    expect(
      await validateAuthorizeRequest(
        validRaw({ redirect_uri: undefined }),
        origin,
      ),
    ).toEqual({ ok: false, kind: "invalidClient" });
    expect(
      await validateAuthorizeRequest(validRaw({ client_id: [] }), origin),
    ).toEqual({ ok: false, kind: "invalidClient" });
  });

  it("redirects unsupported response_type and propagates state", async () => {
    expect(
      await validateAuthorizeRequest(
        validRaw({ response_type: "token", state: "abc" }),
        origin,
      ),
    ).toEqual({
      ok: false,
      kind: "redirect",
      url: errorUrl(
        "unsupported_response_type",
        "Only response_type=code is supported.",
        "abc",
      ),
    });
    expect(
      await validateAuthorizeRequest(
        validRaw({ response_type: undefined }),
        origin,
      ),
    ).toMatchObject({
      ok: false,
      kind: "redirect",
      url: expect.stringContaining("unsupported_response_type"),
    });
  });

  it("requires PKCE S256 with a well-formed challenge", async () => {
    const invalid = "invalid_request";
    const description = "PKCE with code_challenge_method=S256 is required.";

    expect(
      await validateAuthorizeRequest(
        validRaw({ code_challenge: undefined }),
        origin,
      ),
    ).toEqual({
      ok: false,
      kind: "redirect",
      url: errorUrl(invalid, description),
    });
    expect(
      await validateAuthorizeRequest(
        validRaw({ code_challenge_method: "plain" }),
        origin,
      ),
    ).toEqual({
      ok: false,
      kind: "redirect",
      url: errorUrl(invalid, description),
    });
    expect(
      await validateAuthorizeRequest(
        validRaw({ code_challenge_method: undefined }),
        origin,
      ),
    ).toEqual({
      ok: false,
      kind: "redirect",
      url: errorUrl(invalid, description),
    });
    expect(
      await validateAuthorizeRequest(
        validRaw({ code_challenge: "a".repeat(42) }),
        origin,
      ),
    ).toEqual({
      ok: false,
      kind: "redirect",
      url: errorUrl(invalid, description),
    });
  });

  it("rejects a scope other than staff", async () => {
    const result = await validateAuthorizeRequest(
      validRaw({ scope: "admin", state: "st" }),
      origin,
    );
    expect(result).toEqual({
      ok: false,
      kind: "redirect",
      url: errorUrl(
        "invalid_scope",
        'The only supported scope is "staff".',
        "st",
      ),
    });
    expect(
      await validateAuthorizeRequest(
        validRaw({ scope: "staff extra" }),
        origin,
      ),
    ).toMatchObject({ ok: false, kind: "redirect" });
  });

  it("rejects a resource that is not this origin's MCP endpoint", async () => {
    expect(
      await validateAuthorizeRequest(
        validRaw({ resource: "https://evil.example/api/mcp" }),
        origin,
      ),
    ).toEqual({
      ok: false,
      kind: "redirect",
      url: errorUrl("invalid_target", "Unknown resource."),
    });
  });
});
