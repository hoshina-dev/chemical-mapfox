import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { SESSION_COOKIE } from "./constants";
import type { SessionPayload, SessionUser } from "./definitions";
import { decrypt } from "./session";

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await decrypt(cookie);

  if (!session?.userId) {
    return null;
  }

  return session;
});

export function toSessionUser(session: SessionPayload): SessionUser {
  return {
    userId: session.userId,
    name: session.name,
    email: session.email,
    avatarUrl: session.avatarUrl,
    role: session.role,
  };
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "admin") {
    redirect("/dashboard");
  }
  return session;
}
