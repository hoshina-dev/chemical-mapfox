import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { appRoleForSession } from "./appRole";
import { myExperimentsPath } from "../experiment/routes";
import { experimentListingPath } from "../experiment-manager/routes";
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
    redirect("/login");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "admin") {
    redirect(myExperimentsPath());
  }
  return session;
}

/**
 * Backstop for the client-facing experiment flow (`/experiment/*`). Lab staff
 * (app-role `technician`) have their own `/internal/*` workspace and must not
 * see or act in the client request flow, so they're sent to the staff
 * Experiments listing instead.
 */
export async function requireClient(): Promise<SessionPayload> {
  const session = await requireSession();
  if (appRoleForSession(session) === "technician") {
    redirect(experimentListingPath());
  }
  return session;
}
