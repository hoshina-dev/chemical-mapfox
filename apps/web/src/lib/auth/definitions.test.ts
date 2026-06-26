import { describe, expect, it } from "vitest";

import { isAdmin, roleLabel } from "./definitions";

describe("isAdmin", () => {
  it("returns true only for admin role", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("user")).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});

describe("roleLabel", () => {
  it("maps roles to nav badge labels", () => {
    expect(roleLabel("admin")).toBe("Lab Staff");
    expect(roleLabel("user")).toBe("Client");
    expect(roleLabel(undefined)).toBe("Client");
  });
});
