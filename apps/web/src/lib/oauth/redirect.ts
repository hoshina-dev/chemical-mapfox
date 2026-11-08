/**
 * Redirect URIs a dynamically registered client may use. Any HTTPS URI is
 * accepted (staff may use any MCP-capable assistant), plus loopback HTTP for
 * local tools like the MCP Inspector. Hosts outside `KNOWN_AI_HOSTS` get a
 * warning on the consent screen instead of a rejection.
 */

const KNOWN_AI_HOSTS = ["claude.ai", "chatgpt.com"];
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isAllowedRedirectUri(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

export function redirectHost(raw: string): string {
  return new URL(raw).host;
}

/** Whether the redirect belongs to Claude or ChatGPT (or a subdomain of either). */
export function isKnownAiRedirect(raw: string): boolean {
  const { protocol, hostname } = new URL(raw);
  if (protocol !== "https:") return false;
  return KNOWN_AI_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}
