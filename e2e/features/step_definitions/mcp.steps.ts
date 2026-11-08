import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

import { Given, Then, When } from "@cucumber/cucumber";

import { clickUntil } from "../support/interactions.js";
import type { ChemFoxWorld } from "../support/world.js";

/**
 * Per-scenario MCP/OAuth state. Kept on the World instance (same pattern as
 * collab-editing) so `world.ts` stays untouched.
 */

interface RegisteredClient {
  clientId: string;
  clientName: string;
  redirectUri: string;
}

interface HttpCapture {
  status: number;
  headers: Headers;
  text: string;
  json: unknown;
}

interface McpWorld extends ChemFoxWorld {
  mcpClients?: Map<string, RegisteredClient>;
  mcpPkce?: { verifier: string; challenge: string; state: string };
  mcpActiveName?: string;
  mcpCallbackUrl?: string;
  mcpAccessToken?: string;
  mcpRefreshToken?: string;
  mcpPreviousRefreshToken?: string;
  mcpProtectedResourceUrl?: string;
  lastHttp?: HttpCapture;
  lastMcp?: unknown;
}

const LAB_TOOLS = [
  "list_experiments",
  "get_experiment",
  "record_lab_values",
  "check_in_sample",
  "start_experiment",
  "submit_experiment",
  "close_ticket",
  "run_calculations",
  "generate_report",
  "get_report_download_url",
] as const;

const MCP_PROTOCOL_VERSION = "2025-11-25";
const MCP_ACCEPT = "application/json, text/event-stream";

function mcp(world: ChemFoxWorld): McpWorld {
  return world as McpWorld;
}

function clientsOf(world: McpWorld): Map<string, RegisteredClient> {
  world.mcpClients ??= new Map();
  return world.mcpClients;
}

function requireClient(world: McpWorld, name: string): RegisteredClient {
  const client = clientsOf(world).get(name);
  assert.ok(client, `no MCP client registered as "${name}"`);
  return client;
}

function activeClient(world: McpWorld): RegisteredClient {
  assert.ok(world.mcpActiveName, "no MCP client is active");
  return requireClient(world, world.mcpActiveName);
}

function pkce(): { verifier: string; challenge: string; state: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("hex");
  return { verifier, challenge, state };
}

function authorizePath(
  world: McpWorld,
  client: RegisteredClient,
): string {
  world.mcpPkce = pkce();
  const { challenge, state } = world.mcpPkce;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    scope: "staff",
    resource: `${world.baseUrl}/api/mcp`,
  });
  return `/oauth/authorize?${params}`;
}

function loginForm(world: ChemFoxWorld) {
  return world.page
    .locator("form")
    .filter({ has: world.page.getByRole("button", { name: "Sign in" }) });
}

function callbackMatches(world: McpWorld, href: string): boolean {
  try {
    const expected = new URL(activeClient(world).redirectUri);
    const actual = new URL(href);
    return (
      actual.origin === expected.origin && actual.pathname === expected.pathname
    );
  } catch {
    return false;
  }
}

async function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      assert.fail(`${label} (waited ${timeoutMs}ms)`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * Playwright does not intercept the target of a redirect, so a 303 to
 * claude.ai would leave the browser. Capture Location from the decision POST
 * itself and fulfill locally so we never navigate off-origin.
 */
async function interceptDecision(world: McpWorld): Promise<void> {
  await world.page.route(
    "**/oauth/authorize/decision",
    async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const res = await route.fetch({ maxRedirects: 0 });
      const location = res.headers().location;
      assert.ok(
        location,
        `decision POST returned HTTP ${res.status()} without Location: ${(await res.text()).slice(0, 500)}`,
      );
      world.mcpCallbackUrl = new URL(location, world.baseUrl).href;
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><p>OAuth callback</p>",
      });
    },
  );
}

async function appFetch(
  world: ChemFoxWorld,
  pathOrUrl: string,
  init?: RequestInit,
): Promise<HttpCapture> {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${world.baseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
  const res = await fetch(url, { ...init, redirect: "manual" });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    json = undefined;
  }
  const capture: HttpCapture = {
    status: res.status,
    headers: res.headers,
    text,
    json,
  };
  mcp(world).lastHttp = capture;
  return capture;
}

function jsonBody(capture: HttpCapture): Record<string, unknown> {
  assert.ok(
    capture.json && typeof capture.json === "object",
    `expected JSON, got HTTP ${capture.status}: ${capture.text.slice(0, 500)}`,
  );
  return capture.json as Record<string, unknown>;
}

async function mcpRpc(
  world: McpWorld,
  method: string,
  params?: Record<string, unknown>,
  token = world.mcpAccessToken,
): Promise<unknown> {
  assert.ok(token, "no access token to call MCP with");
  const payload: Record<string, unknown> = {
    jsonrpc: "2.0",
    id: 1,
    method,
  };
  if (params !== undefined) payload.params = params;

  const capture = await appFetch(world, "/api/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: MCP_ACCEPT,
    },
    body: JSON.stringify(payload),
  });
  assert.equal(
    capture.status,
    200,
    `MCP ${method} returned HTTP ${capture.status}: ${capture.text.slice(0, 800)}`,
  );
  const body = parseMcpBody(capture);
  world.lastMcp = body;
  return body;
}

function parseMcpBody(capture: HttpCapture): unknown {
  const type = capture.headers.get("content-type") ?? "";
  if (type.includes("text/event-stream")) {
    const dataLines = capture.text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter((line) => line.length > 0);
    const last = dataLines.at(-1);
    assert.ok(last, `SSE MCP response had no data: ${capture.text.slice(0, 500)}`);
    return JSON.parse(last) as unknown;
  }
  assert.ok(
    capture.json !== undefined,
    `expected JSON MCP body, got: ${capture.text.slice(0, 500)}`,
  );
  return capture.json;
}

function rpcResult(body: unknown): Record<string, unknown> {
  assert.ok(body && typeof body === "object", `MCP body is not an object: ${String(body)}`);
  const obj = body as { result?: unknown; error?: unknown };
  assert.equal(
    obj.error,
    undefined,
    `MCP JSON-RPC error: ${JSON.stringify(obj.error)}`,
  );
  assert.ok(obj.result && typeof obj.result === "object", "MCP response missing result");
  return obj.result as Record<string, unknown>;
}

function toolPayload(body: unknown): Record<string, unknown> {
  const result = rpcResult(body);
  assert.notEqual(result.isError, true, `MCP tool error: ${JSON.stringify(result)}`);
  const content = result.content;
  assert.ok(Array.isArray(content) && content.length > 0, "MCP tool result has no content");
  const first = content[0] as { type?: string; text?: string };
  assert.equal(first.type, "text");
  assert.equal(typeof first.text, "string");
  const text = first.text;
  assert.ok(text, "MCP tool result text is empty");
  return JSON.parse(text) as Record<string, unknown>;
}

function callbackUrl(world: McpWorld): URL {
  assert.ok(world.mcpCallbackUrl, "no OAuth callback was captured from the decision POST");
  assert.ok(
    callbackMatches(world, world.mcpCallbackUrl),
    `expected redirect to the client callback, got ${world.mcpCallbackUrl}`,
  );
  return new URL(world.mcpCallbackUrl);
}

async function submitConsent(
  world: McpWorld,
  decision: "Allow access" | "Cancel",
): Promise<void> {
  const button = world.page.getByRole("button", { name: decision, exact: true });
  try {
    await button.waitFor({ state: "visible", timeout: 30_000 });
  } catch (error) {
    assert.fail(
      `consent "${decision}" button missing. URL=${world.page.url()}\n${await pageText(world)}\n${String(error)}`,
    );
  }
  assert.equal(
    await button.isEnabled(),
    true,
    `consent "${decision}" button is disabled. ${await pageText(world)}`,
  );
  world.mcpCallbackUrl = undefined;
  await interceptDecision(world);
  // One native click so the submitter is this button (name=decision, value=approve|deny).
  await button.click();
  await waitUntil(
    () => Boolean(world.mcpCallbackUrl),
    15_000,
    "decision POST never returned a redirect Location",
  );
}

async function exchangeCode(world: McpWorld): Promise<void> {
  const client = activeClient(world);
  const pkceState = world.mcpPkce;
  assert.ok(pkceState, "no PKCE verifier was generated");
  const url = callbackUrl(world);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  assert.ok(code, `callback is missing code: ${url.href}`);
  assert.equal(state, pkceState.state);
  const capture = await appFetch(world, "/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: client.clientId,
      code,
      redirect_uri: client.redirectUri,
      code_verifier: pkceState.verifier,
    }),
  });
  assert.equal(
    capture.status,
    200,
    `token exchange failed (${capture.status}): ${capture.text.slice(0, 500)}`,
  );
  const body = jsonBody(capture);
  assert.equal(typeof body.access_token, "string");
  assert.equal(typeof body.refresh_token, "string");
  world.mcpAccessToken = body.access_token as string;
  world.mcpRefreshToken = body.refresh_token as string;
}

// --- discovery -----------------------------------------------------------

When(
  "I POST {string} without a bearer token",
  async function (this: McpWorld, path: string) {
    await appFetch(this, path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: MCP_ACCEPT,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "e2e", version: "1.0.0" },
        },
      }),
    });
  },
);

Then(
  "the HTTP response status is {int}",
  function (this: McpWorld, status: number) {
    assert.ok(this.lastHttp, "no HTTP response has been captured");
    assert.equal(
      this.lastHttp.status,
      status,
      `HTTP ${this.lastHttp.status}: ${this.lastHttp.text.slice(0, 500)}`,
    );
  },
);

Then(
  "the WWW-Authenticate header points at the protected-resource metadata",
  function (this: McpWorld) {
    assert.ok(this.lastHttp, "no HTTP response has been captured");
    const challenge = this.lastHttp.headers.get("www-authenticate") ?? "";
    const match = challenge.match(/resource_metadata="([^"]+)"/);
    assert.ok(
      match,
      `WWW-Authenticate missing resource_metadata: ${challenge || "(absent)"}`,
    );
    const url = match[1];
    assert.match(url, /\/\.well-known\/oauth-protected-resource\/api\/mcp$/);
    this.mcpProtectedResourceUrl = url;
  },
);

When(
  "I GET the protected-resource metadata from that challenge",
  async function (this: McpWorld) {
    assert.ok(
      this.mcpProtectedResourceUrl,
      "no protected-resource metadata URL was captured",
    );
    await appFetch(this, this.mcpProtectedResourceUrl);
  },
);

When(
  "I GET {string} without a session",
  async function (this: McpWorld, path: string) {
    await appFetch(this, path);
  },
);

Then(
  "the metadata document is JSON reachable without a session",
  function (this: McpWorld) {
    assert.ok(this.lastHttp, "no HTTP response has been captured");
    assert.equal(
      this.lastHttp.status,
      200,
      `expected 200 without a session, got ${this.lastHttp.status} (Location: ${this.lastHttp.headers.get("location")})`,
    );
    const type = this.lastHttp.headers.get("content-type") ?? "";
    assert.match(type, /application\/json/i);
    jsonBody(this.lastHttp);
  },
);

Then(
  "it advertises this origin as the authorization server",
  function (this: McpWorld) {
    assert.ok(this.lastHttp, "no HTTP response has been captured");
    const body = jsonBody(this.lastHttp);
    assert.equal(body.resource, `${this.baseUrl}/api/mcp`);
    assert.deepEqual(body.authorization_servers, [this.baseUrl]);
  },
);

Then(
  "the authorization server metadata advertises S256 and the registration endpoint",
  function (this: McpWorld) {
    assert.ok(this.lastHttp, "no HTTP response has been captured");
    assert.equal(this.lastHttp.status, 200);
    const body = jsonBody(this.lastHttp);
    const methods = body.code_challenge_methods_supported;
    assert.ok(Array.isArray(methods), "code_challenge_methods_supported missing");
    assert.ok(
      methods.includes("S256"),
      `S256 not advertised: ${JSON.stringify(methods)}`,
    );
    assert.equal(body.registration_endpoint, `${this.baseUrl}/oauth/register`);
  },
);

// --- registration + consent ----------------------------------------------

Given(
  "I register an MCP client named {string} with redirect URI {string}",
  async function (this: McpWorld, name: string, redirectUri: string) {
    const capture = await appFetch(this, "/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        redirect_uris: [redirectUri],
        client_name: name,
      }),
    });
    assert.equal(
      capture.status,
      201,
      `DCR failed (${capture.status}): ${capture.text.slice(0, 500)}`,
    );
    const body = jsonBody(capture);
    assert.equal(typeof body.client_id, "string");
    clientsOf(this).set(name, {
      clientId: body.client_id as string,
      clientName: name,
      redirectUri,
    });
  },
);

When(
  "I open the OAuth authorize page for {string}",
  async function (this: McpWorld, name: string) {
    const client = requireClient(this, name);
    this.mcpActiveName = name;
    this.mcpCallbackUrl = undefined;
    await this.goto(authorizePath(this, client));
  },
);

When(
  "I sign in on this page with email {string} and password {string}",
  async function (this: McpWorld, email: string, password: string) {
    const form = loginForm(this);
    await form.waitFor({ state: "visible", timeout: 30_000 });
    await form.locator('input[name="email"]').fill(email);
    await form.locator('input[name="password"]').fill(password);
    await clickUntil(
      this,
      form.getByRole("button", { name: "Sign in" }),
      async () => this.currentPath() === "/oauth/authorize",
    );
  },
);

async function pageText(world: ChemFoxWorld): Promise<string> {
  return world.page.locator("body").innerText().catch(() => world.page.url());
}

Then("I should be on the OAuth consent page", async function (this: McpWorld) {
  await this.page.waitForURL(
    (url) => new URL(url).pathname === "/oauth/authorize",
    { timeout: 30_000 },
  );
  const allow = this.page.getByRole("button", {
    name: "Allow access",
    exact: true,
  });
  try {
    await allow.waitFor({ state: "visible", timeout: 30_000 });
  } catch (error) {
    assert.fail(
      `OAuth consent page did not show "Allow access". URL=${this.page.url()}\n${await pageText(this)}\n${String(error)}`,
    );
  }
});

When("I allow OAuth access", async function (this: McpWorld) {
  await submitConsent(this, "Allow access");
});

When("I cancel OAuth access", async function (this: McpWorld) {
  await submitConsent(this, "Cancel");
});

Given("I complete the MCP OAuth consent", async function (this: McpWorld) {
  const client = [...clientsOf(this).values()].at(-1);
  assert.ok(client, "no MCP client has been registered");
  this.mcpActiveName = client.clientName;
  await this.goto(authorizePath(this, client));
  await submitConsent(this, "Allow access");
  await exchangeCode(this);
});

When(
  "I exchange the authorization code for tokens",
  async function (this: McpWorld) {
    await exchangeCode(this);
  },
);

Then(
  "the token response includes an access token and a refresh token",
  function (this: McpWorld) {
    assert.ok(this.mcpAccessToken, "no access token was issued");
    assert.ok(this.mcpRefreshToken, "no refresh token was issued");
  },
);

Then(
  "I should not be able to allow OAuth access",
  async function (this: McpWorld) {
    const allow = this.page.getByRole("button", {
      name: "Allow access",
      exact: true,
    });
    assert.equal(await allow.count(), 0);
  },
);

Then(
  "the OAuth callback has error {string} and the original state",
  function (this: McpWorld, error: string) {
    const url = callbackUrl(this);
    assert.equal(url.searchParams.get("error"), error);
    assert.equal(url.searchParams.get("state"), this.mcpPkce?.state);
    assert.equal(url.searchParams.get("code"), null);
  },
);

Then(
  "the unknown-app warning should not be shown",
  async function (this: McpWorld) {
    const warning = this.page.getByText("This app isn't Claude or ChatGPT", {
      exact: false,
    });
    assert.equal(await warning.count(), 0);
  },
);

// --- MCP JSON-RPC --------------------------------------------------------

When("I send MCP {string}", async function (this: McpWorld, method: string) {
  if (method === "initialize") {
    await mcpRpc(this, "initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "e2e", version: "1.0.0" },
    });
    return;
  }
  await mcpRpc(this, method);
});

Then("the tool list includes the lab workspace tools", function (this: McpWorld) {
  const result = rpcResult(this.lastMcp);
  const tools = result.tools;
  assert.ok(Array.isArray(tools), "tools/list result has no tools array");
  const names = tools.map((tool) => {
    assert.ok(tool && typeof tool === "object");
    return (tool as { name: string }).name;
  });
  for (const expected of LAB_TOOLS) {
    assert.ok(names.includes(expected), `missing tool ${expected}: ${names.join(", ")}`);
  }
});

When(
  "I call MCP tool {string}",
  async function (this: McpWorld, name: string) {
    await mcpRpc(this, "tools/call", { name, arguments: {} });
  },
);

When(
  "I call MCP tool {string} with context id {string}",
  async function (this: McpWorld, name: string, contextId: string) {
    await mcpRpc(this, "tools/call", {
      name,
      arguments: { contextId },
    });
  },
);

Then(
  "the MCP tool result includes experiment {string}",
  function (this: McpWorld, contextId: string) {
    const payload = toolPayload(this.lastMcp);
    const experiments = payload.experiments;
    assert.ok(Array.isArray(experiments), "list_experiments result has no experiments");
    const match = experiments.find((row) => {
      return (
        row &&
        typeof row === "object" &&
        (row as { contextId?: string }).contextId === contextId
      );
    });
    assert.ok(
      match,
      `experiment ${contextId} not in ${JSON.stringify(experiments)}`,
    );
  },
);

// --- refresh tokens ------------------------------------------------------

When("I exchange the refresh token", async function (this: McpWorld) {
  const client = activeClient(this);
  assert.ok(this.mcpRefreshToken, "no refresh token to exchange");
  this.mcpPreviousRefreshToken = this.mcpRefreshToken;
  const capture = await appFetch(this, "/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: client.clientId,
      refresh_token: this.mcpRefreshToken,
    }),
  });
  assert.equal(
    capture.status,
    200,
    `refresh failed (${capture.status}): ${capture.text.slice(0, 500)}`,
  );
  const body = jsonBody(capture);
  assert.equal(typeof body.access_token, "string");
  assert.equal(typeof body.refresh_token, "string");
  assert.notEqual(body.refresh_token, this.mcpPreviousRefreshToken);
  this.mcpAccessToken = body.access_token as string;
  this.mcpRefreshToken = body.refresh_token as string;
});

Then(
  "the new access token can call the MCP server",
  async function (this: McpWorld) {
    const body = await mcpRpc(this, "initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "e2e", version: "1.0.0" },
    });
    const result = rpcResult(body);
    const info = result.serverInfo as { name?: string } | undefined;
    assert.equal(info?.name, "chemfox-lab");
  },
);

When("I reuse the previous refresh token", async function (this: McpWorld) {
  const client = activeClient(this);
  assert.ok(this.mcpPreviousRefreshToken, "no previous refresh token to reuse");
  await appFetch(this, "/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: client.clientId,
      refresh_token: this.mcpPreviousRefreshToken,
    }),
  });
});

Then(
  "the token endpoint rejects it with {string}",
  function (this: McpWorld, error: string) {
    assert.ok(this.lastHttp, "no HTTP response has been captured");
    assert.ok(
      this.lastHttp.status >= 400,
      `expected a token error, got HTTP ${this.lastHttp.status}: ${this.lastHttp.text}`,
    );
    const body = jsonBody(this.lastHttp);
    assert.equal(body.error, error);
  },
);
