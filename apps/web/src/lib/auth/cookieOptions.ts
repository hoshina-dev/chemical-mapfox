import { SESSION_DURATION_MS } from "./constants";

type CookieOptionsInput = {
  expires?: Date;
};

function configuredSecureCookie(): boolean | undefined {
  const value = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function shouldUseSecureSessionCookie(): boolean {
  const configured = configuredSecureCookie();
  if (configured !== undefined) return configured;

  return process.env.NODE_ENV === "production";
}

export function sessionCookieOptions(input: CookieOptionsInput = {}) {
  return {
    httpOnly: true,
    secure: shouldUseSecureSessionCookie(),
    expires: input.expires ?? new Date(Date.now() + SESSION_DURATION_MS),
    sameSite: "lax" as const,
    path: "/",
  };
}
