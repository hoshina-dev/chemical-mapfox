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

import { usersApi } from "@/lib/custapi/client";
import { logHandledError } from "@/lib/log/handled";
import { getRedis } from "@/lib/redis/client";

import {
  ABSOLUTE_MAX_MS,
  createSessionRecord,
  destroySession,
  resolveSession,
  revokeUserSessions,
  ROLE_CHECK_INTERVAL_MS,
  ROLE_STALE_MAX_MS,
  updateUserSessions,
} from "./sessionStore";

const admin = {
  id: "u1",
  name: "Ada",
  email: "ada@example.com",
  avatarUrl: "https://cdn/ada.png",
  role: "admin" as const,
  organizationId: "org",
};

const getUser = vi.mocked(usersApi.usersIdIdGet);

function custapiUser(overrides: Record<string, unknown> = {}) {
  return {
    id: admin.id,
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

let now = Date.UTC(2026, 9, 1);
function advance(ms: number) {
  now += ms;
  vi.setSystemTime(now);
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  await getRedis().flushall();
  getUser.mockReset().mockResolvedValue(custapiUser());
  vi.mocked(logHandledError).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createSessionRecord + resolveSession", () => {
  it("round-trips the user and never stores the raw token", async () => {
    const token = await createSessionRecord(admin);

    expect(await resolveSession(token)).toEqual({
      userId: "u1",
      name: "Ada",
      email: "ada@example.com",
      avatarUrl: "https://cdn/ada.png",
      role: "admin",
      organizationId: "org",
    });
    const keys = await getRedis().keys("*");
    expect(keys.some((key) => key.includes(token))).toBe(false);
  });

  it("treats a missing or unknown token as signed out", async () => {
    expect(await resolveSession(undefined)).toBeNull();
    expect(await resolveSession("")).toBeNull();
    expect(await resolveSession("not-a-session")).toBeNull();
  });

  it("fails closed when Redis errors", async () => {
    const spy = vi
      .spyOn(getRedis(), "get")
      .mockRejectedValueOnce(new Error("down"));

    expect(await resolveSession("token")).toBeNull();
    expect(logHandledError).toHaveBeenCalledWith(expect.any(Error), {
      op: "session.resolve",
      service: "redis",
    });
    spy.mockRestore();
  });

  it("ends a session past the absolute lifetime even while active", async () => {
    const token = await createSessionRecord(admin);
    for (let elapsed = 0; elapsed <= ABSOLUTE_MAX_MS; elapsed += 6 * 864e5) {
      advance(6 * 864e5);
      await resolveSession(token);
    }

    expect(await resolveSession(token)).toBeNull();
    expect(await getRedis().smembers("user:u1:sessions")).toEqual([]);
  });
});

describe("role revalidation", () => {
  it("skips custapi while the last check is fresh", async () => {
    const token = await createSessionRecord(admin);
    advance(ROLE_CHECK_INTERVAL_MS - 1);

    await resolveSession(token);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("picks up a role and profile changed in custapi", async () => {
    const token = await createSessionRecord(admin);
    getUser.mockResolvedValue(custapiUser({ role: "user", name: "Ada L." }));
    advance(ROLE_CHECK_INTERVAL_MS + 1);

    expect(await resolveSession(token)).toMatchObject({
      role: "user",
      name: "Ada L.",
    });
    // Persisted: the next request within the interval needs no custapi call.
    getUser.mockClear();
    expect((await resolveSession(token))?.role).toBe("user");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("revokes every session of a user custapi no longer knows", async () => {
    const first = await createSessionRecord(admin);
    const second = await createSessionRecord(admin);
    getUser.mockRejectedValue(httpError(404));
    advance(ROLE_CHECK_INTERVAL_MS + 1);

    expect(await resolveSession(first)).toBeNull();
    getUser.mockResolvedValue(custapiUser());
    expect(await resolveSession(second)).toBeNull();
  });

  it("keeps the stored role through a short custapi outage, then fails closed", async () => {
    const token = await createSessionRecord(admin);
    getUser.mockRejectedValue(httpError(503));
    advance(6 * 60 * 1000);

    expect((await resolveSession(token))?.role).toBe("admin");
    expect(logHandledError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ op: "session.revalidate", status: 503 }),
    );

    advance(ROLE_STALE_MAX_MS);
    expect(await resolveSession(token)).toBeNull();

    // Not revoked: it works again once custapi answers.
    getUser.mockResolvedValue(custapiUser());
    expect((await resolveSession(token))?.role).toBe("admin");
  });

  it("does not resurrect a session revoked while revalidating", async () => {
    const token = await createSessionRecord(admin);
    getUser.mockImplementation(async () => {
      await revokeUserSessions("u1");
      return custapiUser();
    });
    advance(ROLE_CHECK_INTERVAL_MS + 1);

    await resolveSession(token);
    getUser.mockResolvedValue(custapiUser());
    expect(await resolveSession(token)).toBeNull();
  });
});

describe("ending sessions", () => {
  it("destroySession ends only that session", async () => {
    const mine = await createSessionRecord(admin);
    const other = await createSessionRecord(admin);

    await destroySession(mine);
    await destroySession("unknown");

    expect(await resolveSession(mine)).toBeNull();
    expect(await resolveSession(other)).not.toBeNull();
  });

  it("revokeUserSessions signs the user out everywhere and leaves others alone", async () => {
    const first = await createSessionRecord(admin);
    const second = await createSessionRecord(admin);
    const someoneElse = await createSessionRecord({ ...admin, id: "u2" });

    await revokeUserSessions("u1");
    await revokeUserSessions("nobody");

    expect(await resolveSession(first)).toBeNull();
    expect(await resolveSession(second)).toBeNull();
    expect((await resolveSession(someoneElse))?.userId).toBe("u2");
  });
});

describe("updateUserSessions", () => {
  it("copies profile edits into every live session and prunes dead entries", async () => {
    const first = await createSessionRecord(admin);
    const second = await createSessionRecord(admin);
    await getRedis().sadd("user:u1:sessions", "stale-hash");

    await updateUserSessions("u1", {
      name: "Ada Lovelace",
      email: admin.email,
      avatarUrl: undefined,
    });

    for (const token of [first, second]) {
      expect(await resolveSession(token)).toMatchObject({
        name: "Ada Lovelace",
        role: "admin",
      });
    }
    expect(await getRedis().sismember("user:u1:sessions", "stale-hash")).toBe(
      0,
    );
  });
});
