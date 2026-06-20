import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, SESSION_DURATION_MS } from "@/lib/auth/constants";
import { sessionCookieOptions } from "@/lib/auth/cookieOptions";
import { decryptSession } from "@/lib/auth/sessionCrypto";

export default async function proxy(req: NextRequest) {
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = await decryptSession(session);
  const { pathname } = req.nextUrl;
  const isAuthPage = pathname === "/";

  if (isAuthPage && payload?.userId) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (!isAuthPage && !payload?.userId) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // /internal/* is admin-only.
  if (pathname.startsWith("/internal") && payload?.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
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
