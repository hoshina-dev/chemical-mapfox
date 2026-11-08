const AUTHORIZE_PATH = "/oauth/authorize";

/**
 * Where to send the user after signing in, if not their landing page. Only the
 * OAuth consent screen needs the round trip, so nothing else is accepted: an
 * open `?next=` would be a phishing redirect.
 */
export function safeReturnTo(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return raw === AUTHORIZE_PATH || raw.startsWith(`${AUTHORIZE_PATH}?`)
    ? raw
    : null;
}

export function loginPathWithReturnTo(returnTo: string): string {
  return `/login?${new URLSearchParams({ next: returnTo })}`;
}
