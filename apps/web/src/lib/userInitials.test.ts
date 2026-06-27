import { describe, expect, it } from "vitest";

import { userInitials } from "./userInitials";

describe("userInitials", () => {
  it("uses first and last name letters", () => {
    expect(userInitials({ name: "Alice Smith" })).toBe("AS");
    expect(userInitials({ name: "Bob Jones" })).toBe("BJ");
  });

  it("handles extra whitespace and middle names", () => {
    expect(userInitials({ name: "  Alice   Smith  " })).toBe("AS");
    expect(userInitials({ name: "Alice Marie Smith" })).toBe("AS");
  });

  it("falls back to a single initial for one-word names", () => {
    expect(userInitials({ name: "Alice" })).toBe("A");
  });

  it("falls back to email when name is missing", () => {
    expect(userInitials({ email: "alice.smith@example.com" })).toBe("AS");
    expect(userInitials({ email: "alice@example.com" })).toBe("A");
  });

  it("returns ? when nothing usable is provided", () => {
    expect(userInitials({})).toBe("?");
    expect(userInitials({ name: "   " })).toBe("?");
  });
});
