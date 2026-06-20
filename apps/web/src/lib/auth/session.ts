import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

import { SESSION_COOKIE, SESSION_DURATION_MS } from "./constants";
import { sessionCookieOptions } from "./cookieOptions";
import type { CustApiRole, SessionPayload } from "./definitions";

function getEncodedKey() {
  const secretKey = process.env.JWT_SECRET;
  if (!secretKey && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  return new TextEncoder().encode(
    secretKey ?? "chemical-mapfox-dev-session-secret",
  );
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, expiresAt: payload.expiresAt.toISOString() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getEncodedKey());
}

export async function decrypt(
  session: string | undefined = "",
): Promise<SessionPayload | undefined> {
  try {
    const { payload } = await jwtVerify(session, getEncodedKey(), {
      algorithms: ["HS256"],
    });
    return {
      ...payload,
      expiresAt: new Date(payload.expiresAt as string),
    } as unknown as SessionPayload;
  } catch {
    return undefined;
  }
}

export async function createSession(user: {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: CustApiRole;
  organizationId?: string;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await encrypt({
    userId: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    organizationId: user.organizationId,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE,
    session,
    sessionCookieOptions({ expires: expiresAt }),
  );
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
