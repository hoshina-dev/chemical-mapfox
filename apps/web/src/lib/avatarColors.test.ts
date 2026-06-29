import { describe, expect, it } from "vitest";

import { avatarColorFor, avatarColorSeed } from "./avatarColors";

describe("avatarColorFor", () => {
  it("returns a stable color for the same input", () => {
    expect(avatarColorFor("alice@example.com")).toBe(avatarColorFor("alice@example.com"));
  });

  it("returns one of the palette colors", () => {
    const color = avatarColorFor("bob@example.com");
    expect(["blue", "grape", "green", "orange", "pink"]).toContain(color);
  });

  it("falls back to blue for empty input", () => {
    expect(avatarColorFor("")).toBe("blue");
  });
});

describe("avatarColorSeed", () => {
  it("prefers a trimmed name over email", () => {
    expect(
      avatarColorSeed({ name: "  Alice  ", email: "alice@example.com" }),
    ).toBe("Alice");
  });

  it("falls back to email and then an empty string", () => {
    expect(avatarColorSeed({ email: "  bob@example.com  " })).toBe(
      "bob@example.com",
    );
    expect(avatarColorSeed({})).toBe("");
  });
});
