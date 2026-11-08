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

  const server = createStaffMcpServer(actor);
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

// No server-initiated stream or session to delete in stateless mode.
async function methodNotAllowed(request: Request) {
  const origin = await getRequestOrigin();
  const actor = await authenticate(request, origin);
  if (actor instanceof Response) return actor;
  return withCors(
    new NextResponse(null, { status: 405, headers: { Allow: "POST, OPTIONS" } }),
  );
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;

export function OPTIONS() {
  return preflight();
}
