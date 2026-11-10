import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis/client", async () => {
  const { default: RedisMock } = await import("ioredis-mock");
  const redis = new RedisMock();
  return { getRedis: () => redis, getSubscriber: () => redis };
});
vi.mock("@/lib/custapi/client", () => ({
  usersApi: { usersIdIdGet: vi.fn() },
}));
vi.mock("@/lib/log/handled", () => ({ logHandledError: vi.fn() }));

import { ROLE_CHECK_INTERVAL_MS, ROLE_STALE_MAX_MS } from "@/lib/auth/userRefresh";
import { usersApi } from "@/lib/custapi/client";
import { logHandledError } from "@/lib/log/handled";
import { getRedis } from "@/lib/redis/client";

import {
  ACCESS_TOKEN_TTL_S,
  CODE_TTL_S,
  consumeAuthCode,
  createAuthCode,
  getClient,
  GRANT_ABSOLUTE_MAX_MS,
  issueGrant,
  listUserGrants,
  refreshGrant,
  registerClient,
  resolveAccessToken,
  revokeToken,
  revokeUserGrant,
  revokeUserGrants,
  type AuthCodeRecord,
  type GrantUser,
  type OAuthClient,
} from "./store";

const admin: GrantUser = {
  userId: "u1",
  name: "Ada",
  email: "ada@example.com",
  avatarUrl: "https://cdn/ada.png",
  role: "admin",
};

const getUser = vi.mocked(usersApi.usersIdIdGet);

function custapiUser(overrides: Record<string, unknown> = {}) {
  return {
    id: admin.userId,
    name: admin.name,
    email: admin.email,
    avatarUrl: admin.avatarUrl,
    role: "admin",
    ...overrides,
  } as never;
}

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

const START = Date.UTC(2026, 9, 1);
let now = START;
function advance(ms: number) {
  now += ms;
  vi.setSystemTime(now);
}

const redirectUri = "https://claude.ai/api/mcp/auth_callback";
const resource = "https://lab.example/api/mcp";

async function registeredClient(
  overrides: Partial<{ clientName: string; redirectUris: string[] }> = {},
): Promise<OAuthClient> {
  return registerClient({
    clientName: overrides.clientName ?? "Claude",
    redirectUris: overrides.redirectUris ?? [redirectUri],
  });
}

function codeRecord(
  client: OAuthClient,
  user: GrantUser = admin,
  extra: Partial<AuthCodeRecord> = {},
): AuthCodeRecord {
  return {
    clientId: client.clientId,
    redirectUri: client.redirectUris[0] ?? redirectUri,
    codeChallenge: "a".repeat(43),
    scope: "experiments:read experiments:write",
    resource,
    user,
    ...extra,
  };
}

async function tokensFor(
  client?: OAuthClient,
  user?: GrantUser,
  extra?: Partial<AuthCodeRecord>,
) {
  const registered = client ?? (await registeredClient());
  return {
    client: registered,
    tokens: await issueGrant(codeRecord(registered, user, extra), registered),
  };
}

async function patchGrant(
  grantId: string,
  patch: Record<string, unknown>,
) {
  const key = `oauth:grant:${grantId}`;
  const stored = JSON.parse((await getRedis().get(key))!) as Record<
    string,
    unknown
  >;
  await getRedis().set(key, JSON.stringify({ ...stored, ...patch }));
}

beforeEach(async () => {
  now = START;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  await getRedis().flushall();
  getUser.mockReset().mockResolvedValue(custapiUser());
  vi.mocked(logHandledError).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("clients", () => {
  it("round-trips a dynamically registered client", async () => {
    const client = await registeredClient();
    expect(client.clientName).toBe("Claude");
    expect(client.redirectUris).toEqual([redirectUri]);
    expect(client.createdAt).toBe(now);
    expect(await getClient(client.clientId)).toEqual(client);
  });

  it("returns null for an unknown client", async () => {
    expect(await getClient("missing")).toBeNull();
  });
});

describe("authorization codes", () => {
  it("are single-use", async () => {
    const client = await registeredClient();
    const record = codeRecord(client);
    const code = await createAuthCode(record);

    expect(await consumeAuthCode(code)).toEqual(record);
    expect(await consumeAuthCode(code)).toBeNull();
  });

  it("expire and are stored only as a hash", async () => {
    const client = await registeredClient();
    const code = await createAuthCode(codeRecord(client));
    const hash = createHash("sha256").update(code).digest("hex");
    const key = `oauth:code:${hash}`;

    expect(await getRedis().ttl(key)).toBe(CODE_TTL_S);
    const keys = await getRedis().keys("*");
    expect(keys.some((k) => k.includes(code))).toBe(false);

    await getRedis().del(key);
    expect(await consumeAuthCode(code)).toBeNull();
  });

  it("returns null for an unknown code", async () => {
    expect(await consumeAuthCode("not-a-code")).toBeNull();
  });
});

describe("issueGrant + resolveAccessToken", () => {
  it("round-trips the actor and never stores the raw tokens", async () => {
    const { tokens } = await tokensFor();

    expect(tokens.expiresIn).toBe(ACCESS_TOKEN_TTL_S);
    expect(tokens.scope).toBe("experiments:read experiments:write");
    expect(await resolveAccessToken(tokens.accessToken)).toEqual({
      grantId: expect.any(String),
      clientId: expect.any(String),
      clientName: "Claude",
      scope: "experiments:read experiments:write",
      resource,
      ...admin,
    });

    const keys = await getRedis().keys("*");
    expect(keys.some((k) => k.includes(tokens.accessToken))).toBe(false);
    expect(keys.some((k) => k.includes(tokens.refreshToken))).toBe(false);
  });

  it("returns null for a missing token or a token whose grant is gone", async () => {
    expect(await resolveAccessToken("unknown")).toBeNull();

    const { tokens } = await tokensFor();
    const actor = await resolveAccessToken(tokens.accessToken);
    await getRedis().del(`oauth:grant:${actor!.grantId}`);
    expect(await resolveAccessToken(tokens.accessToken)).toBeNull();
  });

  it("preserves optional profile fields and a null resource", async () => {
    const user: GrantUser = {
      userId: "u2",
      name: "Casey",
      email: "casey@example.com",
    };
    const { tokens } = await tokensFor(undefined, user, { resource: null });
    expect(await resolveAccessToken(tokens.accessToken)).toMatchObject({
      userId: "u2",
      avatarUrl: undefined,
      role: undefined,
      resource: null,
    });
  });
});

describe("refreshGrant", () => {
  it("rotates tokens; the old access token still resolves until the old refresh is reused", async () => {
    const { client, tokens: first } = await tokensFor();
    const rotated = await refreshGrant(client.clientId, first.refreshToken);

    expect(rotated).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: ACCESS_TOKEN_TTL_S,
      scope: "experiments:read experiments:write",
    });
    expect(rotated!.accessToken).not.toBe(first.accessToken);
    expect(rotated!.refreshToken).not.toBe(first.refreshToken);

    expect(await resolveAccessToken(first.accessToken)).not.toBeNull();
    expect(await resolveAccessToken(rotated!.accessToken)).not.toBeNull();

    expect(
      await refreshGrant(client.clientId, first.refreshToken),
    ).toBeNull();
    expect(await resolveAccessToken(rotated!.accessToken)).toBeNull();
    expect(await resolveAccessToken(first.accessToken)).toBeNull();
  });

  it("returns null for an unknown refresh token", async () => {
    expect(await refreshGrant("client", "missing")).toBeNull();
  });

  it("returns null when the grant is gone", async () => {
    const { client, tokens } = await tokensFor();
    const actor = await resolveAccessToken(tokens.accessToken);
    await getRedis().del(`oauth:grant:${actor!.grantId}`);
    expect(await refreshGrant(client.clientId, tokens.refreshToken)).toBeNull();
  });

  it("returns null for the wrong client without revoking the grant", async () => {
    const { client, tokens } = await tokensFor();
    const other = await registeredClient({ clientName: "Other" });

    expect(await refreshGrant(other.clientId, tokens.refreshToken)).toBeNull();
    expect(await resolveAccessToken(tokens.accessToken)).not.toBeNull();
    expect(
      await refreshGrant(client.clientId, tokens.refreshToken),
    ).not.toBeNull();
  });

  it("revokes a grant that has passed its absolute lifetime", async () => {
    const { client, tokens } = await tokensFor();
    const actor = await resolveAccessToken(tokens.accessToken);
    await patchGrant(actor!.grantId, {
      createdAt: now - GRANT_ABSOLUTE_MAX_MS - 1,
    });

    expect(await refreshGrant(client.clientId, tokens.refreshToken)).toBeNull();
    expect(await resolveAccessToken(tokens.accessToken)).toBeNull();
  });

  it("does not resurrect a grant revoked while rotating", async () => {
    const { client, tokens } = await tokensFor();
    const redis = getRedis();
    const originalSet = redis.set.bind(redis);
    const spy = vi.spyOn(redis, "set").mockImplementation((...args: never[]) => {
      const key = String(args[0]);
      if (key.startsWith("oauth:grant:") && args.at(-1) === "XX") {
        return redis.del(key).then(() => originalSet(...args));
      }
      return originalSet(...args);
    });

    expect(await refreshGrant(client.clientId, tokens.refreshToken)).toBeNull();
    spy.mockRestore();
    expect(await resolveAccessToken(tokens.accessToken)).toBeNull();
  });
});

describe("role revalidation", () => {
  it("skips custapi while the last check is fresh", async () => {
    const { tokens } = await tokensFor();
    advance(ROLE_CHECK_INTERVAL_MS - 1);

    await resolveAccessToken(tokens.accessToken);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("picks up a role and profile changed in custapi", async () => {
    const { tokens } = await tokensFor();
    getUser.mockResolvedValue(custapiUser({ role: "user", name: "Ada L." }));
    advance(ROLE_CHECK_INTERVAL_MS + 1);

    expect(await resolveAccessToken(tokens.accessToken)).toMatchObject({
      role: "user",
      name: "Ada L.",
    });
    getUser.mockClear();
    expect((await resolveAccessToken(tokens.accessToken))?.role).toBe("user");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("revokes every grant of a user custapi no longer knows", async () => {
    const { tokens: first } = await tokensFor();
    const { tokens: second } = await tokensFor();
    getUser.mockRejectedValue(httpError(404));
    advance(ROLE_CHECK_INTERVAL_MS + 1);

    expect(await resolveAccessToken(first.accessToken)).toBeNull();
    getUser.mockResolvedValue(custapiUser());
    expect(await resolveAccessToken(second.accessToken)).toBeNull();
  });

  it("keeps the stored role through a short custapi outage, then fails closed", async () => {
    const { tokens } = await tokensFor();
    getUser.mockRejectedValue(httpError(503));
    advance(ROLE_CHECK_INTERVAL_MS + 1);

    expect((await resolveAccessToken(tokens.accessToken))?.role).toBe("admin");
    expect(logHandledError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ op: "oauth.revalidate", status: 503 }),
    );

    const actor = await resolveAccessToken(tokens.accessToken);
    await patchGrant(actor!.grantId, {
      roleCheckedAt: now - ROLE_STALE_MAX_MS - 1,
    });
    expect(await resolveAccessToken(tokens.accessToken)).toBeNull();

    getUser.mockResolvedValue(custapiUser());
    expect((await resolveAccessToken(tokens.accessToken))?.role).toBe("admin");
  });

  it("does not resurrect a grant revoked while revalidating", async () => {
    const { tokens } = await tokensFor();
    getUser.mockImplementation(async () => {
      await revokeUserGrants("u1");
      return custapiUser();
    });
    advance(ROLE_CHECK_INTERVAL_MS + 1);

    expect(await resolveAccessToken(tokens.accessToken)).toBeNull();
    getUser.mockResolvedValue(custapiUser());
    expect(await resolveAccessToken(tokens.accessToken)).toBeNull();
  });

  it("touches lastUsedAt after five idle minutes without a role check", async () => {
    const { tokens } = await tokensFor();
    const actor = await resolveAccessToken(tokens.accessToken);
    const key = `oauth:grant:${actor!.grantId}`;
    const stored = JSON.parse((await getRedis().get(key))!) as {
      lastUsedAt: number;
      roleCheckedAt: number;
    };
    stored.lastUsedAt = now - (5 * 60 * 1000 + 1);
    await getRedis().set(key, JSON.stringify(stored));

    expect(await resolveAccessToken(tokens.accessToken)).not.toBeNull();
    const updated = JSON.parse((await getRedis().get(key))!) as {
      lastUsedAt: number;
      roleCheckedAt: number;
    };
    expect(updated.lastUsedAt).toBe(now);
    expect(updated.roleCheckedAt).toBe(stored.roleCheckedAt);
  });
});

describe("listing + revocation", () => {
  it("lists newest first and prunes stale ids", async () => {
    const { client, tokens: older } = await tokensFor();
    advance(1_000);
    const newer = await issueGrant(
      codeRecord(client, admin, { resource: null }),
      client,
    );
    await getRedis().sadd("user:u1:grants", "stale-id");

    const listed = await listUserGrants("u1");
    expect(listed.map((app) => app.clientName)).toEqual(["Claude", "Claude"]);
    expect(listed[0]!.createdAt).toBeGreaterThan(listed[1]!.createdAt);
    expect(listed[0]!.redirectHost).toBe("claude.ai");
    expect(await getRedis().sismember("user:u1:grants", "stale-id")).toBe(0);

    expect(await resolveAccessToken(older.accessToken)).not.toBeNull();
    expect(await resolveAccessToken(newer.accessToken)).not.toBeNull();
  });

  it("returns an empty list when the user has no grants", async () => {
    expect(await listUserGrants("nobody")).toEqual([]);
  });

  it("revokeUserGrant only deletes a grant the user owns", async () => {
    const { tokens } = await tokensFor();
    const actor = await resolveAccessToken(tokens.accessToken);

    expect(await revokeUserGrant("someone-else", actor!.grantId)).toBe(false);
    expect(await revokeUserGrant("u1", "missing")).toBe(false);
    expect(await resolveAccessToken(tokens.accessToken)).not.toBeNull();

    expect(await revokeUserGrant("u1", actor!.grantId)).toBe(true);
    expect(await resolveAccessToken(tokens.accessToken)).toBeNull();
  });

  it("revokeUserGrants ends every grant for that user and leaves others alone", async () => {
    const { tokens: first } = await tokensFor();
    const { tokens: second } = await tokensFor();
    const { tokens: other } = await tokensFor(undefined, {
      ...admin,
      userId: "u2",
    });

    await revokeUserGrants("u1");
    await revokeUserGrants("nobody");

    expect(await resolveAccessToken(first.accessToken)).toBeNull();
    expect(await resolveAccessToken(second.accessToken)).toBeNull();
    expect((await resolveAccessToken(other.accessToken))?.userId).toBe("u2");
  });

  it("revokeToken accepts access or refresh tokens and ignores other clients", async () => {
    const { client, tokens } = await tokensFor();
    const other = await registeredClient({ clientName: "Other" });

    await revokeToken(other.clientId, tokens.accessToken);
    expect(await resolveAccessToken(tokens.accessToken)).not.toBeNull();

    await revokeToken(client.clientId, "unknown");
    expect(await resolveAccessToken(tokens.accessToken)).not.toBeNull();

    await revokeToken(client.clientId, tokens.accessToken);
    expect(await resolveAccessToken(tokens.accessToken)).toBeNull();

    const { client: nextClient, tokens: next } = await tokensFor();
    await revokeToken(nextClient.clientId, next.refreshToken);
    expect(await resolveAccessToken(next.accessToken)).toBeNull();
  });

  it("ignores a token whose grant is already gone", async () => {
    const { client, tokens } = await tokensFor();
    const actor = await resolveAccessToken(tokens.accessToken);
    await getRedis().del(`oauth:grant:${actor!.grantId}`);
    await revokeToken(client.clientId, tokens.accessToken);
  });
});
