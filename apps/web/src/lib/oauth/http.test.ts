import { describe, expect, it } from "vitest";

import {
  oauthError,
  oauthJson,
  preflight,
  readParams,
  withCors,
} from "./http";

function cors(res: Response) {
  return {
    origin: res.headers.get("Access-Control-Allow-Origin"),
    methods: res.headers.get("Access-Control-Allow-Methods"),
    headers: res.headers.get("Access-Control-Allow-Headers"),
    expose: res.headers.get("Access-Control-Expose-Headers"),
  };
}

describe("withCors + preflight", () => {
  it("sets the MCP Inspector CORS headers on an existing response", () => {
    const res = withCors(new Response("ok"));
    expect(cors(res)).toEqual({
      origin: "*",
      methods: "GET, POST, DELETE, OPTIONS",
      headers:
        "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id",
      expose: "WWW-Authenticate, Mcp-Session-Id",
    });
  });

  it("answers OPTIONS with 204 and the same CORS headers", () => {
    const res = preflight();
    expect(res.status).toBe(204);
    expect(cors(res).origin).toBe("*");
  });
});

describe("oauthJson + oauthError", () => {
  it("returns JSON with no-store and CORS, defaulting to 200", async () => {
    const res = oauthJson({ client_id: "abc" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(cors(res).origin).toBe("*");
    expect(await res.json()).toEqual({ client_id: "abc" });
  });

  it("honours an explicit status", async () => {
    const res = oauthJson({ ok: true }, 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("shapes OAuth errors, defaulting to 400", async () => {
    const res = oauthError("invalid_grant", "Code expired");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "invalid_grant",
      error_description: "Code expired",
    });
    expect(cors(res).origin).toBe("*");
  });

  it("honours an explicit error status", async () => {
    const res = oauthError("invalid_client", "Unknown client", 401);
    expect(res.status).toBe(401);
  });
});

describe("readParams", () => {
  it("reads JSON string fields and drops everything else", async () => {
    const request = new Request("https://lab.example/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        count: 1,
        flag: true,
        nested: { a: "b" },
        empty: null,
      }),
    });
    expect(await readParams(request)).toEqual({ grant_type: "refresh_token" });
  });

  it("reads application/x-www-form-urlencoded bodies", async () => {
    const request = new Request("https://lab.example/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=authorization_code&code=abc",
    });
    expect(await readParams(request)).toEqual({
      grant_type: "authorization_code",
      code: "abc",
    });
  });

  it("treats a missing content-type as form-encoded", async () => {
    const request = new Request("https://lab.example/oauth/revoke", {
      method: "POST",
      body: "token=xyz",
    });
    expect(await readParams(request)).toEqual({ token: "xyz" });
  });

  it("reads an empty body when Content-Type is absent", async () => {
    const request = new Request("https://lab.example/oauth/token");
    expect(request.headers.get("content-type")).toBeNull();
    expect(await readParams(request)).toEqual({});
  });

  it("returns null when the JSON body cannot be parsed as an object", async () => {
    const invalid = new Request("https://lab.example/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(await readParams(invalid)).toBeNull();

    const jsonNull = new Request("https://lab.example/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "null",
    });
    expect(await readParams(jsonNull)).toBeNull();
  });
});
