import { describe, expect, it } from "vitest";

import { organizationPageUrl } from "./url";

describe("organizationPageUrl", () => {
  it("builds an organization page URL from base and id", () => {
    expect(
      organizationPageUrl("https://portal.example.com", "org-123"),
    ).toBe("https://portal.example.com/organization/org-123");
  });

  it("strips a trailing slash from the base URL", () => {
    expect(
      organizationPageUrl("https://portal.example.com/", "org-123"),
    ).toBe("https://portal.example.com/organization/org-123");
  });

  it("encodes special characters in the org id", () => {
    expect(
      organizationPageUrl("https://portal.example.com", "org/with spaces"),
    ).toBe("https://portal.example.com/organization/org%2Fwith%20spaces");
  });
});
