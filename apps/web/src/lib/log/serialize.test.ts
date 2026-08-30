import { describe, expect, it } from "vitest";

import { httpStatus, redact, safeUrl, serializeError } from "./serialize";

describe("safeUrl", () => {
  it("strips query and hash from an absolute URL", () => {
    expect(
      safeUrl("https://bucket.example/file.pdf?X-Amz-Signature=secret#frag"),
    ).toBe("https://bucket.example/file.pdf");
  });

  it("strips query from a non-absolute URL", () => {
    expect(safeUrl("/api/users?token=abc")).toBe("/api/users");
  });

  it("returns the original string when there is nothing to strip", () => {
    expect(safeUrl("not a url")).toBe("not a url");
    expect(safeUrl("")).toBe("");
  });
});

describe("httpStatus", () => {
  it("returns undefined for non-objects", () => {
    expect(httpStatus(undefined)).toBeUndefined();
    expect(httpStatus("boom")).toBeUndefined();
  });

  it("reads a numeric status field", () => {
    expect(httpStatus({ status: 502 })).toBe(502);
  });

  it("reads status from a Response", () => {
    expect(httpStatus({ response: new Response(null, { status: 409 }) })).toBe(
      409,
    );
  });
});

describe("redact", () => {
  it("leaves primitives and null alone", () => {
    expect(redact(null)).toBeNull();
    expect(redact("ok")).toBe("ok");
    expect(redact(3)).toBe(3);
  });

  it("redacts sensitive keys and serializes dates and buffers", () => {
    const date = new Date("2026-01-02T03:04:05.000Z");
    expect(
      redact({
        password: "hunter2",
        access_key: "ak",
        jwt: "tok",
        when: date,
        blob: Buffer.from("hi"),
        items: [{ authorization: "Bearer x", name: "ok" }],
      }),
    ).toEqual({
      password: "[Redacted]",
      access_key: "[Redacted]",
      jwt: "[Redacted]",
      when: "2026-01-02T03:04:05.000Z",
      blob: "[Buffer 2]",
      items: [{ authorization: "[Redacted]", name: "ok" }],
    });
  });

  it("breaks cycles and truncates deep objects", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(redact(cyclic)).toEqual({ self: "[Circular]" });

    let deep: unknown = "leaf";
    for (let i = 0; i < 8; i += 1) deep = { nested: deep };
    const redacted = redact(deep) as { nested: { nested: { nested: unknown } } };
    expect(JSON.stringify(redacted)).toContain("[Truncated]");
  });
});

describe("serializeError", () => {
  it("serializes Error fields including status, body, url, and cause", () => {
    const cause = new Error("root");
    const error = new Error("downstream failed", { cause }) as Error & {
      status: number;
      body: { password: string; detail: string };
      response: Response;
    };
    error.status = 500;
    error.body = { password: "secret", detail: "nope" };
    error.response = new Response(null, { status: 500 });
    Object.defineProperty(error.response, "url", {
      value: "https://api.example/v1/users?token=abc",
    });

    const serialized = serializeError(error);
    expect(serialized.name).toBe("Error");
    expect(serialized.message).toBe("downstream failed");
    expect(serialized.status).toBe(500);
    expect(serialized.body).toEqual({
      password: "[Redacted]",
      detail: "nope",
    });
    expect(serialized.url).toBe("https://api.example/v1/users");
    expect(serialized.cause).toMatchObject({ message: "root" });
    expect(serialized.stack).toEqual(expect.any(String));
  });

  it("omits an empty stack", () => {
    const error = new Error("no stack");
    error.stack = "";
    expect(serializeError(error)).toEqual({
      name: "Error",
      message: "no stack",
    });
  });

  it("redacts plain objects and stringifies primitives", () => {
    expect(serializeError({ secret: "x", ok: 1 })).toEqual({
      secret: "[Redacted]",
      ok: 1,
    });
    expect(serializeError("plain")).toEqual({ message: "plain" });
  });

  it("breaks a self-referencing cause chain instead of recursing forever", () => {
    const error = new Error("loop") as Error & { cause: unknown };
    error.cause = error;

    const serialized = serializeError(error);
    expect(serialized.cause).toEqual({ message: "[Circular]" });
  });

  it("breaks a cause cycle between two errors", () => {
    const a = new Error("a") as Error & { cause: unknown };
    const b = new Error("b") as Error & { cause: unknown };
    a.cause = b;
    b.cause = a;

    const serialized = serializeError(a);
    expect(serialized.cause).toMatchObject({ message: "b" });
    expect((serialized.cause as { cause: unknown }).cause).toEqual({
      message: "[Circular]",
    });
  });

  it("truncates an unbounded (non-cyclic) cause chain", () => {
    let error: Error = new Error("root");
    for (let i = 0; i < 10; i += 1) {
      error = new Error(`level ${i}`, { cause: error });
    }

    expect(JSON.stringify(serializeError(error))).toContain("[Truncated]");
  });
});
