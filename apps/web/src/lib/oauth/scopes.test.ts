import { describe, expect, it } from "vitest";

import { formatScope, grantedScopes, parseRequestedScope } from "./scopes";

const ALL = ["experiments:read", "experiments:write", "templates:write"];

describe("parseRequestedScope", () => {
  it("treats no scope and the legacy scope as everything", () => {
    expect(parseRequestedScope(undefined)).toEqual(ALL);
    expect(parseRequestedScope("  ")).toEqual(ALL);
    expect(parseRequestedScope("staff")).toEqual(ALL);
    expect(parseRequestedScope("experiments:read staff")).toEqual(ALL);
  });

  it("always includes read and returns canonical order", () => {
    expect(parseRequestedScope("templates:write")).toEqual(["experiments:read", "templates:write"]);
    expect(parseRequestedScope("templates:write experiments:read templates:write")).toEqual([
      "experiments:read",
      "templates:write",
    ]);
  });

  it("rejects an unknown scope", () => {
    expect(parseRequestedScope("experiments:read admin")).toBeNull();
  });
});

describe("grantedScopes", () => {
  it("expands legacy grants and falls back to read for garbage", () => {
    expect([...grantedScopes("staff")]).toEqual(ALL);
    expect([...grantedScopes("experiments:read")]).toEqual(["experiments:read"]);
    expect([...grantedScopes("bogus")]).toEqual(["experiments:read"]);
  });
});

describe("formatScope", () => {
  it("joins in canonical order", () => {
    expect(formatScope(["templates:write", "experiments:read"])).toBe("experiments:read templates:write");
  });
});
