import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyDownstream,
  createLoggedFetch,
  loggedFetch,
  peekBody,
  requestUrl,
} from "./downstream";

beforeEach(() => {
  process.env.LOG_LEVEL = "debug";
  process.env.LOG_PRETTY = "0";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("requestUrl", () => {
  it("reads string, URL, Request, and fallback values", () => {
    expect(requestUrl("https://api.example/x")).toBe("https://api.example/x");
    expect(requestUrl(new URL("https://api.example/y"))).toBe(
      "https://api.example/y",
    );
    expect(requestUrl(new Request("https://api.example/z"))).toBe(
      "https://api.example/z",
    );
    expect(requestUrl(42 as unknown as RequestInfo)).toBe("42");
  });
});

describe("classifyDownstream", () => {
  it("skips successes and expected domain statuses", () => {
    expect(classifyDownstream("custapi", "/users", 200)).toBeNull();
    expect(
      classifyDownstream("experiment-manager", "/api/experiments/1", 404),
    ).toBeNull();
    expect(
      classifyDownstream("custapi", "http://custapi/api/v1/auth/verify", 401),
    ).toBeNull();
    expect(
      classifyDownstream("custapi", "https://custapi/api/v1/users/abc-123", 404),
    ).toBeNull();
  });

  it("warns on 4xx and errors on 5xx", () => {
    expect(classifyDownstream("ticketing", "/tickets", 422)).toBe("warn");
    expect(classifyDownstream("s3", "https://bucket/file", 404)).toBe("warn");
    expect(classifyDownstream("custapi", "/users", 500)).toBe("error");
  });

  it("does not exempt a lookalike path outside the exact rule", () => {
    // /users/search shares the /users/ prefix with the by-id lookup rule but
    // must not be silently swallowed — it's a different endpoint.
    expect(
      classifyDownstream("custapi", "https://custapi/api/v1/users/search?q=a", 404),
    ).toBe("warn");
    // A user 404 on a different service must not borrow custapi's exemption.
    expect(classifyDownstream("ticketing", "/users/abc-123", 404)).toBe("warn");
  });
});

describe("peekBody", () => {
  it("parses JSON, truncates text, and tolerates empty or unreadable bodies", async () => {
    expect(await peekBody(new Response(""))).toBeUndefined();
    expect(
      await peekBody(
        new Response(JSON.stringify({ error: "nope", password: "x" })),
      ),
    ).toEqual({ error: "nope", password: "[Redacted]" });
    expect(await peekBody(new Response("not-json-body"))).toBe("not-json-body");
    expect(
      await peekBody({
        clone() {
          throw new Error("closed");
        },
      } as Response),
    ).toBeUndefined();
  });

  it("truncates a body larger than the size cap instead of parsing it in full", async () => {
    const huge = JSON.stringify({ detail: "x".repeat(10_000) });
    const result = await peekBody(new Response(huge));
    expect(typeof result).toBe("string");
    expect((result as string).length).toBeLessThan(huge.length);
    expect(result).toContain(`[truncated ${huge.length} chars]`);
  });
});

describe("loggedFetch", () => {
  it("logs unexpected statuses and rethrows network failures", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("ok")) return new Response("{}", { status: 200 });
        if (url.includes("missing")) return new Response("", { status: 404 });
        if (url.includes("verify")) return new Response("", { status: 401 });
        if (url.includes("unprocessable")) {
          return new Response(JSON.stringify({ detail: "bad" }), { status: 422 });
        }
        if (url.includes("down")) return new Response("oops", { status: 503 });
        throw new Error("ECONNREFUSED");
      }),
    );

    await expect(
      loggedFetch("custapi", "https://custapi/ok"),
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      loggedFetch("experiment-manager", "https://em/missing"),
    ).resolves.toMatchObject({ status: 404 });
    await expect(
      loggedFetch("custapi", "https://custapi/auth/verify"),
    ).resolves.toMatchObject({ status: 401 });

    await loggedFetch("ticketing", "https://ticketing/unprocessable");
    await loggedFetch("s3", "https://bucket/down");
    await expect(
      loggedFetch("custapi", "https://custapi/throw"),
    ).rejects.toThrow("ECONNREFUSED");

    const lines = [...stdout.mock.calls, ...stderr.mock.calls].map((call) =>
      JSON.parse(String(call[0]).trim()),
    );
    expect(lines.some((l) => l.msg === "downstream request failed" && l.status === 422)).toBe(
      true,
    );
    expect(lines.some((l) => l.msg === "downstream request failed" && l.status === 503)).toBe(
      true,
    );
    expect(lines.some((l) => l.msg === "downstream request threw")).toBe(true);

    const wrapped = createLoggedFetch("custapi");
    await expect(wrapped("https://custapi/ok")).resolves.toMatchObject({
      status: 200,
    });
  });
});
