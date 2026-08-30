import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envLogLevel, Logger, prettyLogsEnabled } from "./logger";

const ENV_KEYS = ["LOG_LEVEL", "LOG_PRETTY", "NODE_ENV"] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  process.env.LOG_LEVEL = "debug";
  process.env.LOG_PRETTY = "0";
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.restoreAllMocks();
});

function parseLast(spy: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  const last = spy.mock.calls.at(-1)?.[0];
  expect(typeof last).toBe("string");
  return JSON.parse(String(last).trim()) as Record<string, unknown>;
}

describe("envLogLevel / prettyLogsEnabled", () => {
  it("honours LOG_LEVEL and defaults by NODE_ENV", () => {
    process.env.LOG_LEVEL = "warn";
    expect(envLogLevel()).toBe("warn");

    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = "production";
    expect(envLogLevel()).toBe("info");

    process.env.NODE_ENV = "development";
    expect(envLogLevel()).toBe("debug");

    process.env.LOG_LEVEL = "nope";
    expect(envLogLevel()).toBe("debug");
  });

  it("honours LOG_PRETTY and defaults off in production", () => {
    process.env.LOG_PRETTY = "1";
    expect(prettyLogsEnabled()).toBe(true);
    process.env.LOG_PRETTY = "0";
    expect(prettyLogsEnabled()).toBe(false);

    delete process.env.LOG_PRETTY;
    process.env.NODE_ENV = "production";
    expect(prettyLogsEnabled()).toBe(false);
    process.env.NODE_ENV = "development";
    expect(prettyLogsEnabled()).toBe(true);
  });
});

describe("Logger", () => {
  it("writes JSON to stdout/stderr with redacted bindings and serialized errors", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const log = new Logger({ app: "web", password: "secret" }).child({
      service: "custapi",
    });

    log.debug("hello");
    log.info({ userId: "u1" });
    log.info({ userId: "u1" }, "saved");
    log.warn({ status: 422 }, "rejected");
    log.error({ err: new Error("boom"), token: "abc" }, "failed");

    expect(parseLast(stdout)).toMatchObject({
      level: "info",
      app: "web",
      password: "[Redacted]",
      service: "custapi",
      userId: "u1",
      msg: "saved",
    });
    expect(parseLast(stderr)).toMatchObject({
      level: "error",
      token: "[Redacted]",
      msg: "failed",
      err: { name: "Error", message: "boom" },
    });
    expect(stdout.mock.calls.length).toBe(3);
    expect(stderr.mock.calls.length).toBe(2);
  });

  it("never lets a caller field named level/time override the real ones", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const log = new Logger();
    log.info({ level: "debug", time: "bogus", userId: "u1" }, "still info");

    const record = parseLast(stdout);
    expect(record.level).toBe("info");
    expect(record.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(record.userId).toBe("u1");
  });

  it("drops records below LOG_LEVEL", () => {
    process.env.LOG_LEVEL = "error";
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const log = new Logger();
    log.debug("nope");
    log.info("nope");
    log.warn("nope");
    log.error("yes");
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledTimes(1);
  });

  it("pretty-prints when enabled", () => {
    process.env.LOG_PRETTY = "1";
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    new Logger().error("failed");
    expect(String(stderr.mock.calls[0]?.[0])).toContain("ERROR failed");

    new Logger({ app: "web" }).error({ err: new Error("boom") }, "failed");
    const line = String(stderr.mock.calls[1]?.[0]);
    expect(line).toContain("ERROR");
    expect(line).toContain("failed");
    expect(line).toContain("boom");
    expect(line.startsWith("{")).toBe(false);
  });

  it("falls back to console when Node streams are missing", () => {
    const stdout = process.stdout;
    const stderr = process.stderr;
    Object.defineProperty(process, "stdout", { configurable: true, value: undefined });
    Object.defineProperty(process, "stderr", { configurable: true, value: undefined });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const log = new Logger();
      log.debug("d");
      log.info("i");
      log.warn("w");
      log.error("e");
      expect(logSpy).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, "stdout", { configurable: true, value: stdout });
      Object.defineProperty(process, "stderr", { configurable: true, value: stderr });
    }
  });
});
