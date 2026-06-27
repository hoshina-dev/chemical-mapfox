import { describe, expect, it } from "vitest";

import { avatarColorFor } from "./avatarColors";

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
