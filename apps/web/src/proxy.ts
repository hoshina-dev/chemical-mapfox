import { NextRequest, NextResponse } from "next/server";

import { landingPathForRole } from "@/lib/auth/appRole";
import { SESSION_COOKIE, SESSION_DURATION_MS } from "@/lib/auth/constants";
import { sessionCookieOptions } from "@/lib/auth/cookieOptions";
import { decryptSession } from "@/lib/auth/sessionCrypto";
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

export default async function proxy(req: NextRequest) {
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = await decryptSession(session);
  const { pathname } = req.nextUrl;
  // The landing page ("/") is public to everyone; the auth page ("/login")
  // is public only to signed-out visitors.
  const isLandingPage = pathname === "/";
  const isAuthPage = pathname === "/login";
  const isPublicPage = isLandingPage || isAuthPage;

  if (isAuthPage && payload?.userId) {
    return withLocaleCookie(
      req,
      NextResponse.redirect(
        new URL(landingPathForRole(payload.role), req.url),
      ),
    );
  }

  if (!isPublicPage && !payload?.userId) {
    return withLocaleCookie(
      req,
      NextResponse.redirect(new URL("/login", req.url)),
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
    res.cookies.set(
      SESSION_COOKIE,
      session,
      sessionCookieOptions({
        expires: new Date(Date.now() + SESSION_DURATION_MS),
      }),
    );
    return withLocaleCookie(req, res);
  }

  return withLocaleCookie(req, NextResponse.next());
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
