import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/custapi/client", () => ({
  usersApi: { usersIdIdGet: vi.fn() },
}));
vi.mock("@/lib/log/handled", () => ({ logHandledError: vi.fn() }));

import { usersApi } from "@/lib/custapi/client";
import { logHandledError } from "@/lib/log/handled";

import {
  refreshUser,
  ROLE_CHECK_INTERVAL_MS,
  ROLE_STALE_MAX_MS,
} from "./userRefresh";

const getUser = vi.mocked(usersApi.usersIdIdGet);

function custapiUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    name: "Ada",
    email: "ada@example.com",
    avatarUrl: "https://cdn/ada.png",
    role: "admin",
    ...overrides,
  } as never;
}

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

beforeEach(() => {
  getUser.mockReset().mockResolvedValue(custapiUser());
  vi.mocked(logHandledError).mockReset();
});

describe("refreshUser", () => {
  it("returns a fresh profile from custapi", async () => {
    expect(await refreshUser("u1", 0, ROLE_CHECK_INTERVAL_MS, "oauth.revalidate")).toEqual({
      kind: "fresh",
      user: {
        name: "Ada",
        email: "ada@example.com",
        avatarUrl: "https://cdn/ada.png",
        role: "admin",
      },
    });
  });

  it("forwards a missing avatarUrl", async () => {
    getUser.mockResolvedValue(custapiUser({ avatarUrl: undefined }));

    expect(await refreshUser("u1", 0, 0, "session.revalidate")).toMatchObject({
      kind: "fresh",
      user: { avatarUrl: undefined, role: "admin" },
    });
  });

  it("treats a 404 as the user being gone, without logging", async () => {
    getUser.mockRejectedValue(httpError(404));

    expect(await refreshUser("u1", 0, 0, "oauth.revalidate")).toEqual({
      kind: "gone",
    });
    expect(logHandledError).not.toHaveBeenCalled();
  });

  it("treats a 404 on error.response the same as error.status", async () => {
    getUser.mockRejectedValue(
      Object.assign(new Error("missing"), {
        response: new Response(null, { status: 404 }),
      }),
    );

    expect(await refreshUser("u1", 0, 0, "oauth.revalidate")).toEqual({
      kind: "gone",
    });
  });

  it("keeps the stored role while custapi is unreachable within the stale window", async () => {
    getUser.mockRejectedValue(httpError(503));
    const checkedAt = 1_000;
    const now = checkedAt + ROLE_STALE_MAX_MS;

    expect(await refreshUser("u1", checkedAt, now, "oauth.revalidate")).toEqual({
      kind: "unreachable",
      usable: true,
    });
    expect(logHandledError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        op: "oauth.revalidate",
        service: "custapi",
        userId: "u1",
        status: 503,
      }),
    );
  });

  it("stops trusting the stored role once the stale window has passed", async () => {
    getUser.mockRejectedValue(httpError(503));
    const checkedAt = 1_000;
    const now = checkedAt + ROLE_STALE_MAX_MS + 1;

    expect(await refreshUser("u1", checkedAt, now, "session.revalidate")).toEqual({
      kind: "unreachable",
      usable: false,
    });
  });

  it("logs errors that have no HTTP status and treats them as unreachable", async () => {
    getUser.mockRejectedValue(new Error("dns"));

    expect(
      await refreshUser("u1", 0, ROLE_STALE_MAX_MS, "oauth.revalidate"),
    ).toEqual({ kind: "unreachable", usable: true });
    expect(logHandledError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ status: undefined, userId: "u1" }),
    );
  });
});
