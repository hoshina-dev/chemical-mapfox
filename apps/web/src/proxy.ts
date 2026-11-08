import { NextRequest, NextResponse } from "next/server";

import { landingPathForRole } from "@/lib/auth/appRole";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { loginPathWithReturnTo, safeReturnTo } from "@/lib/auth/returnTo";
import { sessionCookieOptions } from "@/lib/auth/cookieOptions";
import { resolveSession } from "@/lib/auth/sessionStore";
import {
  isAppLocale,
  LOCALE_COOKIE,
  negotiateLocale,
} from "@/i18n/config";

function withLocaleCookie(req: NextRequest, res: NextResponse): NextResponse {
  const existing = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isAppLocale(existing)) return res;

  const locale = negotiateLocale(req.headers.get("accept-language"));
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}

const OAUTH_MACHINE_ENDPOINT = /^\/(?:\.well-known\/oauth-|oauth\/(?:register|token|revoke)$)/;

export default async function proxy(req: NextRequest) {
  if (OAUTH_MACHINE_ENDPOINT.test(req.nextUrl.pathname)) return NextResponse.next();

  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = await resolveSession(session);
  const { pathname } = req.nextUrl;
  // The landing page ("/") is public to everyone; the auth page ("/login")
  // is public only to signed-out visitors.
  const isLandingPage = pathname === "/";
  const isAuthPage = pathname === "/login";
  const isPublicPage = isLandingPage || isAuthPage;

  if (isAuthPage && payload?.userId) {
    const next = safeReturnTo(req.nextUrl.searchParams.get("next"));
    return withLocaleCookie(
      req,
      NextResponse.redirect(
        new URL(next ?? landingPathForRole(payload.role), req.url),
      ),
    );
  }

  if (!isPublicPage && !payload?.userId) {
    // The OAuth consent screen is reached from Claude/ChatGPT; come back to it.
    const returnTo = safeReturnTo(`${pathname}${req.nextUrl.search}`);
    return withLocaleCookie(
      req,
      NextResponse.redirect(
        new URL(returnTo ? loginPathWithReturnTo(returnTo) : "/login", req.url),
      ),
    );
  }

  // /internal/* and /admin/* are admin-only; send non-admins to their landing page.
  if (
    (pathname.startsWith("/internal") || pathname.startsWith("/admin")) &&
    payload?.role !== "admin"
  ) {
    return withLocaleCookie(
      req,
      NextResponse.redirect(
        new URL(landingPathForRole(payload?.role), req.url),
      ),
    );
  }

  // The client experiment flow (/experiment/*) is client-only; lab staff
  // (mapfox admins, i.e. app-role technician) use /internal/* instead.
  const isClientFlow =
    pathname === "/experiment" || pathname.startsWith("/experiment/");
  if (isClientFlow && payload?.role === "admin") {
    return withLocaleCookie(
      req,
      NextResponse.redirect(
        new URL(landingPathForRole(payload.role), req.url),
      ),
    );
  }

  if (payload?.userId && session) {
    const res = NextResponse.next();
    // Slide the cookie with the Redis idle TTL; Redis stays the authority.
    res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
    return withLocaleCookie(req, res);
  }

  return withLocaleCookie(req, NextResponse.next());
}

// Skip only real static files by extension: a blanket "contains a dot" skip
// let dotted /internal URLs (e.g. an encoded `..%2F` param) bypass the gate.
// OAuth discovery/token endpoints are called by MCP clients without a cookie.
export const config = {
  matcher: [
    "/((?!api|\\.well-known/oauth-|oauth/(?:register|token|revoke)$|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpe?g|webp|gif|ico|md|txt|xml)$).*)",
    "/internal/:path*",
    "/admin/:path*",
  ],
};
