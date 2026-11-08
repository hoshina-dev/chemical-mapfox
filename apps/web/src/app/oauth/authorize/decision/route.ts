import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/dal";
import { getRequestOrigin } from "@/lib/http/origin";
import { logger } from "@/lib/log/logger";
import {
  authorizeRedirectUrl,
  validateAuthorizeRequest,
} from "@/lib/oauth/authorize";
import { createAuthCode } from "@/lib/oauth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Consent screen submission: a plain form POST answered with a 303, so the
 * browser follows the redirect to the client natively, with or without JS.
 * Not a server action, hence the explicit same-origin check.
 */
export async function POST(request: Request) {
  const origin = await getRequestOrigin();
  const requestOrigin = request.headers.get("origin");
  const sameOrigin = requestOrigin
    ? requestOrigin === origin
    : request.headers.get("sec-fetch-site") === "same-origin";
  if (!sameOrigin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.redirect(new URL("/login", origin), 303);
  }

  const form = await request.formData();
  const raw = Object.fromEntries(
    [...form.entries()].flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : [],
    ),
  );
  const result = await validateAuthorizeRequest(raw, origin);
  if (!result.ok) {
    return NextResponse.redirect(
      result.kind === "redirect" ? result.url : new URL("/oauth/authorize", origin),
      303,
    );
  }
  const { params, client } = result;

  if (form.get("decision") !== "approve") {
    return NextResponse.redirect(
      authorizeRedirectUrl(params.redirectUri, {
        error: "access_denied",
        state: params.state,
      }),
      303,
    );
  }

  const code = await createAuthCode({
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    scope: params.scope,
    resource: params.resource,
    user: {
      userId: session.userId,
      name: session.name,
      email: session.email,
      avatarUrl: session.avatarUrl,
      role: session.role,
    },
  });
  logger.info(
    {
      op: "oauth.authorize",
      userId: session.userId,
      clientId: client.clientId,
      clientName: client.clientName,
      redirectUri: params.redirectUri,
    },
    "oauth consent granted",
  );
  return NextResponse.redirect(
    authorizeRedirectUrl(params.redirectUri, { code, state: params.state }),
    303,
  );
}
