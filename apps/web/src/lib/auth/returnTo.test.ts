import { describe, expect, it } from "vitest";

import { loginPathWithReturnTo, safeReturnTo } from "./returnTo";

describe("safeReturnTo", () => {
  it("accepts the authorize path, with or without a query string", () => {
    expect(safeReturnTo("/oauth/authorize")).toBe("/oauth/authorize");
    expect(
      safeReturnTo("/oauth/authorize?client_id=abc&redirect_uri=https%3A%2F%2Fx"),
    ).toBe("/oauth/authorize?client_id=abc&redirect_uri=https%3A%2F%2Fx");
    expect(safeReturnTo("/oauth/authorize?")).toBe("/oauth/authorize?");
  });

  it("rejects open redirects, lookalike paths, and non-strings", () => {
    expect(safeReturnTo("//evil.com")).toBeNull();
    expect(safeReturnTo("https://evil")).toBeNull();
    expect(safeReturnTo("/oauth/authorizeX")).toBeNull();
    expect(safeReturnTo("/oauth/authorize/extra")).toBeNull();
    expect(safeReturnTo("/login")).toBeNull();
    expect(safeReturnTo("oauth/authorize")).toBeNull();
    expect(safeReturnTo("")).toBeNull();
    expect(safeReturnTo(undefined)).toBeNull();
    expect(safeReturnTo(null)).toBeNull();
    expect(safeReturnTo(1)).toBeNull();
    expect(safeReturnTo({ next: "/oauth/authorize" })).toBeNull();
  });
});

describe("loginPathWithReturnTo", () => {
  it("puts the return path in a `next` query param", () => {
    expect(loginPathWithReturnTo("/oauth/authorize")).toBe(
      "/login?next=%2Foauth%2Fauthorize",
    );
    expect(
      loginPathWithReturnTo("/oauth/authorize?client_id=abc"),
    ).toBe("/login?next=%2Foauth%2Fauthorize%3Fclient_id%3Dabc");
  });
});
