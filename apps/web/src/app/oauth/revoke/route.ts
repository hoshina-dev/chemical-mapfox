import { NextResponse } from "next/server";

import { oauthError, preflight, readParams, withCors } from "@/lib/oauth/http";
import { revokeToken } from "@/lib/oauth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RFC 7009: always 200 for a well-formed request, even for unknown tokens. */
export async function POST(request: Request) {
  const params = await readParams(request);
  if (!params?.token || !params.client_id) {
    return oauthError("invalid_request", "token and client_id are required.");
  }
  await revokeToken(params.client_id, params.token);
  return withCors(new NextResponse(null, { status: 200 }));
}

export function OPTIONS() {
  return preflight();
}
