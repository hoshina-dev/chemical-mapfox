import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE } from "./constants";
import { sessionCookieOptions } from "./cookieOptions";
import {
  createSessionRecord,
  destroySession,
  type SessionUserInput,
} from "./sessionStore";

export async function createSession(user: SessionUserInput): Promise<void> {
  const token = await createSessionRecord(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  cookieStore.delete(SESSION_COOKIE);
}
