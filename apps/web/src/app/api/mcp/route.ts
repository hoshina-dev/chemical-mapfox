import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextResponse } from "next/server";

import { getRequestOrigin } from "@/lib/http/origin";
import { logHandledError } from "@/lib/log/handled";
import { createStaffMcpServer } from "@/lib/mcp/server";
import { preflight, withCors } from "@/lib/oauth/http";
import {
  mcpResourceUrl,
  protectedResourceMetadataUrl,
} from "@/lib/oauth/metadata";
import { type McpActor, resolveAccessToken } from "@/lib/oauth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(origin: string, error?: string): Response {
  const challenge = [
    `Bearer resource_metadata="${protectedResourceMetadataUrl(origin)}"`,
    ...(error ? [`error="${error}"`] : []),
  ].join(", ");
  return withCors(
    NextResponse.json(
      { error: error ?? "unauthorized" },
      { status: 401, headers: { "WWW-Authenticate": challenge } },
    ),
  );
}

async function authenticate(
  request: Request,
  origin: string,
): Promise<McpActor | Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return unauthorized(origin);

  let actor: McpActor | null;
  try {
    actor = await resolveAccessToken(token);
  } catch (error) {
    logHandledError(error, { op: "mcp.auth", service: "redis" });
    return withCors(NextResponse.json({ error: "unavailable" }, { status: 503 }));
  }
  if (!actor || (actor.resource !== null && actor.resource !== mcpResourceUrl(origin))) {
    return unauthorized(origin, "invalid_token");
  }
  if (actor.role !== "admin") {
    return withCors(
      NextResponse.json(
        { error: "forbidden", error_description: "Only lab staff can use this server." },
        { status: 403 },
      ),
    );
  }
  return actor;
}

/**
 * Stateless Streamable HTTP: a fresh server per request, JSON responses, no
 * MCP session. All state lives in the backends and Redis, as for the pages.
 */
export async function POST(request: Request) {
  const origin = await getRequestOrigin();
  const actor = await authenticate(request, origin);
  if (actor instanceof Response) return actor;

  const server = createStaffMcpServer(actor, origin);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request, {
      authInfo: {
        token: "",
        clientId: actor.clientId,
        scopes: actor.scope.split(" "),
        extra: { userId: actor.userId },
      },
    });
    return withCors(response);
  } finally {
    await server.close();
  }
}

/**
 * Standalone SSE channel. Cursor opens this after initialize because the SDK
 * advertises tools.listChanged, and it treats the spec-allowed 405 as a failed
 * handshake. Tool calls stay on POST; this stream carries no notifications
 * across those requests, since each POST builds its own server.
 *
 * Do not close the server here. close() ends the stream at once and the
 * client reconnects in a loop. Close when the client aborts, or immediately
 * when the transport refused the request (no SSE body to hold open).
 */
export async function GET(request: Request) {
  const origin = await getRequestOrigin();
  const actor = await authenticate(request, origin);
  if (actor instanceof Response) return actor;

  const server = createStaffMcpServer(actor, origin);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request, {
    authInfo: {
      token: "",
      clientId: actor.clientId,
      scopes: actor.scope.split(" "),
      extra: { userId: actor.userId },
    },
  });
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    await server.close();
    return withCors(response);
  }
  request.signal.addEventListener(
    "abort",
    () => {
      void server.close();
    },
    { once: true },
  );
  return withCors(response);
}

// Stateless mode never issues an Mcp-Session-Id, so there is no session to end.
export async function DELETE(request: Request) {
  const origin = await getRequestOrigin();
  const actor = await authenticate(request, origin);
  if (actor instanceof Response) return actor;
  return withCors(
    new NextResponse(null, { status: 405, headers: { Allow: "GET, POST, OPTIONS" } }),
  );
}

export function OPTIONS() {
  return preflight();
}
