import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { levelForStatus, logHandledError } from "./handled";

beforeEach(() => {
  process.env.LOG_LEVEL = "debug";
  process.env.LOG_PRETTY = "0";
});

afterEach(() => {
  vi.restoreAllMocks();
});

function parseLast(spy: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  return JSON.parse(String(spy.mock.calls.at(-1)?.[0]).trim()) as Record<
    string,
    unknown
  >;
}

describe("logHandledError", () => {
  it("logs unexpected failures at error and expected ones at info", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);

    logHandledError(new Error("boom"), { action: "login" });
    expect(parseLast(stderr)).toMatchObject({
      level: "error",
      action: "login",
      expected: false,
      msg: "handled error",
    });

    logHandledError(new Error("bad password"), {
      action: "login",
      expected: true,
    });
    expect(parseLast(stdout)).toMatchObject({
      level: "info",
      expected: true,
      msg: "handled expected error",
    });
  });

  it("honours an explicit level override", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    logHandledError(new Error("degraded"), {
      op: "loadRequester",
      level: "warn",
    });
    expect(parseLast(stderr)).toMatchObject({
      level: "warn",
      op: "loadRequester",
      msg: "handled error",
    });
  });
});

describe("levelForStatus", () => {
  it("is warn for a client error and error for a server error or unknown status", () => {
    expect(levelForStatus(400)).toBe("warn");
    expect(levelForStatus(404)).toBe("warn");
    expect(levelForStatus(499)).toBe("warn");
    expect(levelForStatus(500)).toBe("error");
    expect(levelForStatus(503)).toBe("error");
    expect(levelForStatus(undefined)).toBe("error");
  });
});
