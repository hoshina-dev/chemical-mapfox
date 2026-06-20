import { jwtVerify } from "jose";

import type { SessionPayload } from "./definitions";

function getEncodedKey() {
  const secretKey = process.env.JWT_SECRET;
  if (!secretKey && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  return new TextEncoder().encode(
    secretKey ?? "chemical-mapfox-dev-session-secret",
  );
}

export async function decryptSession(
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
