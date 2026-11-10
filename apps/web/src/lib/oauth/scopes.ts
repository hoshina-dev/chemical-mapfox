/**
 * MCP connector scopes. Read access is always granted; the consent screen lets
 * staff withhold either write scope. See docs/mcp.md.
 */
export const READ_SCOPE = "experiments:read";
export const WRITE_SCOPES = ["experiments:write", "templates:write"] as const;
export const SCOPES = [READ_SCOPE, ...WRITE_SCOPES] as const;
export type Scope = (typeof SCOPES)[number];

/** The single scope issued before scopes were split. Grants holding it keep full access. */
export const LEGACY_SCOPE = "staff";

const isScope = (value: string): value is Scope => (SCOPES as readonly string[]).includes(value);

/**
 * The scopes a client asked for, always including read. No scope (or the
 * legacy one) means everything. Null when the request names an unknown scope.
 */
export function parseRequestedScope(raw: string | undefined): Scope[] | null {
  const parts = raw?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return [...SCOPES];
  const requested = new Set<Scope>([READ_SCOPE]);
  for (const part of parts) {
    if (part === LEGACY_SCOPE) return [...SCOPES];
    if (!isScope(part)) return null;
    requested.add(part);
  }
  return SCOPES.filter((s) => requested.has(s));
}

/** Scopes a stored grant or token actually carries. */
export function grantedScopes(scope: string): Set<Scope> {
  return new Set(parseRequestedScope(scope) ?? [READ_SCOPE]);
}

export function formatScope(scopes: readonly Scope[]): string {
  return SCOPES.filter((s) => scopes.includes(s)).join(" ");
}
