import { jwtVerify } from "jose";

import type { SessionPayload } from "./definitions";

function getEncodedKey() {
  const secretKey = process.env.JWT_SECRET;
  if (!secretKey) {
    // Allow a static fallback ONLY for local development and tests. Any other
    // environment (production, staging, preview, QA) must supply JWT_SECRET,
    // otherwise sessions could be forged with a source-tree-public key.
    if (
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test"
    ) {
      return new TextEncoder().encode("chemical-mapfox-dev-session-secret");
    }
    throw new Error("JWT_SECRET is required");
  }
  return new TextEncoder().encode(secretKey);
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
