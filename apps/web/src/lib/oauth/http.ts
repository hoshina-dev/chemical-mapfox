import { NextResponse } from "next/server";

// Browser-based MCP clients (e.g. the MCP Inspector) call these endpoints
// cross-origin. No cookies are involved, so a wildcard origin is safe.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

export function withCors(res: Response): Response {
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    res.headers.set(name, value);
  }
  return res;
}

export function preflight(): Response {
  return withCors(new NextResponse(null, { status: 204 }));
}

export function oauthJson(body: unknown, status = 200): Response {
  return withCors(
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    }),
  );
}

export function oauthError(
  error: string,
  description: string,
  status = 400,
): Response {
  return oauthJson({ error, error_description: description }, status);
}

/** Token and revocation requests are form-encoded per spec; accept JSON too. */
export async function readParams(
  request: Request,
): Promise<Record<string, string> | null> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(body).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
    }
    const params = new URLSearchParams(await request.text());
    return Object.fromEntries(params);
  } catch {
    return null;
  }
}
