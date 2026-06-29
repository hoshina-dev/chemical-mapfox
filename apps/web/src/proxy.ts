import { NextRequest, NextResponse } from "next/server";

import { landingPathForRole } from "@/lib/auth/appRole";
import { SESSION_COOKIE, SESSION_DURATION_MS } from "@/lib/auth/constants";
import { sessionCookieOptions } from "@/lib/auth/cookieOptions";
import { decryptSession } from "@/lib/auth/sessionCrypto";

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
    return NextResponse.redirect(
      new URL(landingPathForRole(payload.role), req.url),
    );
  }

  if (!isPublicPage && !payload?.userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // /internal/* is admin-only; send non-admins to their own landing page.
  if (pathname.startsWith("/internal") && payload?.role !== "admin") {
    return NextResponse.redirect(
      new URL(landingPathForRole(payload?.role), req.url),
    );
  }

  // The client experiment flow (/experiment/*) is client-only; lab staff
  // (mapfox admins, i.e. app-role technician) use /internal/* instead.
  const isClientFlow =
    pathname === "/experiment" || pathname.startsWith("/experiment/");
  if (isClientFlow && payload?.role === "admin") {
    return NextResponse.redirect(
      new URL(landingPathForRole(payload.role), req.url),
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
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
