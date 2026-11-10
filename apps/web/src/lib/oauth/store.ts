import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { CustApiRole } from "@/lib/auth/definitions";
import { refreshUser, ROLE_CHECK_INTERVAL_MS } from "@/lib/auth/userRefresh";
import { getRedis } from "@/lib/redis/client";

import { redirectHost } from "./redirect";

/**
 * OAuth 2.1 state for MCP connectors (clients, auth codes, grants, tokens) in
 * Redis. Like sessions, tokens are stored only as SHA-256 hashes.
 * Design: docs/mcp.md.
 */

export const CODE_TTL_S = 60;
export const ACCESS_TOKEN_TTL_S = 60 * 60;
/** Also the grant's idle lifetime: a grant unused this long disappears. */
export const REFRESH_TOKEN_TTL_S = 30 * 24 * 60 * 60;
export const CLIENT_TTL_S = 30 * 24 * 60 * 60;
export const GRANT_ABSOLUTE_MAX_MS = 90 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const clientKey = (id: string) => `oauth:client:${id}`;
const codeKey = (hash: string) => `oauth:code:${hash}`;
const grantKey = (id: string) => `oauth:grant:${id}`;
const accessKey = (hash: string) => `oauth:at:${hash}`;
const refreshKey = (hash: string) => `oauth:rt:${hash}`;
const userGrantsKey = (userId: string) => `user:${userId}:grants`;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export interface OAuthClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: number;
}

export interface GrantUser {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: CustApiRole;
}

export interface AuthCodeRecord {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  /** RFC 8707 resource the token is bound to, when the client sent one. */
  resource: string | null;
  user: GrantUser;
}

interface StoredGrant extends GrantUser {
  grantId: string;
  clientId: string;
  clientName: string;
  redirectHost: string;
  scope: string;
  resource: string | null;
  createdAt: number;
  lastUsedAt: number;
  roleCheckedAt: number;
  /** Hash of the only refresh token that may still be redeemed. */
  refreshHash: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}

/** Who is calling the MCP endpoint, resolved from an access token. */
export interface McpActor extends GrantUser {
  grantId: string;
  clientId: string;
  clientName: string;
  scope: string;
  resource: string | null;
}

export interface ConnectedApp {
  grantId: string;
  clientName: string;
  redirectHost: string;
  scope: string;
  createdAt: number;
  lastUsedAt: number;
}

// --- Clients (RFC 7591 dynamic registration) ---

export async function registerClient(input: {
  clientName: string;
  redirectUris: string[];
}): Promise<OAuthClient> {
  const client: OAuthClient = {
    clientId: randomUUID(),
    clientName: input.clientName,
    redirectUris: input.redirectUris,
    createdAt: Date.now(),
  };
  await getRedis().set(
    clientKey(client.clientId),
    JSON.stringify(client),
    "EX",
    CLIENT_TTL_S,
  );
  return client;
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const raw = await getRedis().get(clientKey(clientId));
  return raw ? (JSON.parse(raw) as OAuthClient) : null;
}

// --- Authorization codes ---

export async function createAuthCode(record: AuthCodeRecord): Promise<string> {
  const code = newToken();
  await getRedis().set(
    codeKey(hashToken(code)),
    JSON.stringify(record),
    "EX",
    CODE_TTL_S,
  );
  return code;
}

/** Single use: the code is deleted by the read that redeems it. */
export async function consumeAuthCode(
  code: string,
): Promise<AuthCodeRecord | null> {
  const raw = await getRedis().getdel(codeKey(hashToken(code)));
  return raw ? (JSON.parse(raw) as AuthCodeRecord) : null;
}

// --- Grants + tokens ---

async function writeGrant(grant: StoredGrant, mode: "NX" | "XX"): Promise<boolean> {
  const key = grantKey(grant.grantId);
  const value = JSON.stringify(grant);
  const redis = getRedis();
  const res =
    mode === "NX"
      ? await redis.set(key, value, "EX", REFRESH_TOKEN_TTL_S, "NX")
      : await redis.set(key, value, "EX", REFRESH_TOKEN_TTL_S, "XX");
  return res === "OK";
}

async function readGrant(grantId: string): Promise<StoredGrant | null> {
  const raw = await getRedis().get(grantKey(grantId));
  return raw ? (JSON.parse(raw) as StoredGrant) : null;
}

async function mintTokens(grant: StoredGrant): Promise<TokenSet> {
  const accessToken = newToken();
  const refreshToken = newToken();
  grant.refreshHash = hashToken(refreshToken);
  await getRedis()
    .multi()
    .set(accessKey(hashToken(accessToken)), grant.grantId, "EX", ACCESS_TOKEN_TTL_S)
    .set(refreshKey(grant.refreshHash), grant.grantId, "EX", REFRESH_TOKEN_TTL_S)
    .expire(clientKey(grant.clientId), CLIENT_TTL_S)
    .exec();
  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_S,
    scope: grant.scope,
  };
}

export async function issueGrant(
  code: AuthCodeRecord,
  client: OAuthClient,
): Promise<TokenSet> {
  const now = Date.now();
  const grant: StoredGrant = {
    ...code.user,
    grantId: randomUUID(),
    clientId: client.clientId,
    clientName: client.clientName,
    redirectHost: redirectHost(code.redirectUri),
    scope: code.scope,
    resource: code.resource,
    createdAt: now,
    lastUsedAt: now,
    roleCheckedAt: now,
    refreshHash: "",
  };
  const tokens = await mintTokens(grant);
  await writeGrant(grant, "NX");
  await getRedis()
    .multi()
    .sadd(userGrantsKey(grant.userId), grant.grantId)
    .expire(userGrantsKey(grant.userId), REFRESH_TOKEN_TTL_S)
    .exec();
  return tokens;
}

/**
 * Rotates the refresh token. Rotated tokens keep their key until it expires so
 * that presenting one again is detected: it means the token leaked (or the
 * client raced itself), and the whole grant is revoked.
 */
export async function refreshGrant(
  clientId: string,
  refreshToken: string,
): Promise<TokenSet | null> {
  const hash = hashToken(refreshToken);
  const grantId = await getRedis().get(refreshKey(hash));
  if (!grantId) return null;
  const grant = await readGrant(grantId);
  if (!grant || grant.clientId !== clientId) return null;
  if (grant.refreshHash !== hash) {
    await revokeGrant(grant.grantId, grant.userId);
    return null;
  }
  if (Date.now() - grant.createdAt > GRANT_ABSOLUTE_MAX_MS) {
    await revokeGrant(grant.grantId, grant.userId);
    return null;
  }
  const tokens = await mintTokens(grant);
  grant.lastUsedAt = Date.now();
  // XX: a grant revoked while this request ran must stay revoked.
  if (!(await writeGrant(grant, "XX"))) return null;
  await getRedis().expire(userGrantsKey(grant.userId), REFRESH_TOKEN_TTL_S);
  return tokens;
}

/**
 * The caller behind an access token, with the same 60 s custapi role re-check
 * as cookie sessions. Returns null when the token must not be honoured. The
 * role is returned, not enforced: the MCP route decides what a role may do.
 */
export async function resolveAccessToken(
  token: string,
): Promise<McpActor | null> {
  const grantId = await getRedis().get(accessKey(hashToken(token)));
  if (!grantId) return null;
  let grant = await readGrant(grantId);
  if (!grant) return null;

  const now = Date.now();
  let dirty = false;
  if (now - grant.roleCheckedAt > ROLE_CHECK_INTERVAL_MS) {
    const result = await refreshUser(
      grant.userId,
      grant.roleCheckedAt,
      now,
      "oauth.revalidate",
    );
    if (result.kind === "gone") {
      await revokeUserGrants(grant.userId);
      return null;
    }
    if (result.kind === "unreachable" && !result.usable) return null;
    if (result.kind === "fresh") {
      grant = { ...grant, ...result.user, roleCheckedAt: now };
      dirty = true;
    }
  }
  if (dirty || now - grant.lastUsedAt > TOUCH_INTERVAL_MS) {
    grant = { ...grant, lastUsedAt: now };
    if (!(await writeGrant(grant, "XX"))) return null;
  }

  return {
    grantId: grant.grantId,
    clientId: grant.clientId,
    clientName: grant.clientName,
    scope: grant.scope,
    resource: grant.resource,
    userId: grant.userId,
    name: grant.name,
    email: grant.email,
    avatarUrl: grant.avatarUrl,
    role: grant.role,
  };
}

// --- Listing + revocation ---

export async function listUserGrants(userId: string): Promise<ConnectedApp[]> {
  const redis = getRedis();
  const ids = await redis.smembers(userGrantsKey(userId));
  const apps: ConnectedApp[] = [];
  for (const id of ids) {
    const grant = await readGrant(id);
    if (!grant) {
      await redis.srem(userGrantsKey(userId), id);
      continue;
    }
    apps.push({
      grantId: grant.grantId,
      clientName: grant.clientName,
      redirectHost: grant.redirectHost,
      scope: grant.scope,
      createdAt: grant.createdAt,
      lastUsedAt: grant.lastUsedAt,
    });
  }
  return apps.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Deleting the grant is enough: every access and refresh token resolves
 * through it, so outstanding tokens stop working immediately.
 */
async function revokeGrant(grantId: string, userId: string): Promise<void> {
  await getRedis()
    .multi()
    .del(grantKey(grantId))
    .srem(userGrantsKey(userId), grantId)
    .exec();
}

/** Revokes one of the user's own grants; false if it isn't theirs. */
export async function revokeUserGrant(
  userId: string,
  grantId: string,
): Promise<boolean> {
  const grant = await readGrant(grantId);
  if (!grant || grant.userId !== userId) return false;
  await revokeGrant(grantId, userId);
  return true;
}

export async function revokeUserGrants(userId: string): Promise<void> {
  const redis = getRedis();
  const ids = await redis.smembers(userGrantsKey(userId));
  await redis
    .multi()
    .del(...ids.map(grantKey), userGrantsKey(userId))
    .exec();
}

/** RFC 7009: either token type revokes the grant it belongs to. */
export async function revokeToken(clientId: string, token: string): Promise<void> {
  const hash = hashToken(token);
  const redis = getRedis();
  const grantId =
    (await redis.get(accessKey(hash))) ?? (await redis.get(refreshKey(hash)));
  if (!grantId) return;
  const grant = await readGrant(grantId);
  if (grant && grant.clientId === clientId) {
    await revokeGrant(grant.grantId, grant.userId);
  }
}
