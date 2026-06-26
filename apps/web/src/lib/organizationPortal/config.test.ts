import { afterEach, describe, expect, it } from "vitest";

import { getOrganizationPortalUrl } from "./config";

describe("getOrganizationPortalUrl", () => {
  afterEach(() => {
    delete process.env.ORGANIZATION_PORTAL_URL;
  });

  it("reads ORGANIZATION_PORTAL_URL and strips a trailing slash", () => {
    process.env.ORGANIZATION_PORTAL_URL = "https://portal.example.com/";
    expect(getOrganizationPortalUrl()).toBe("https://portal.example.com");
  });

  it("falls back to the placeholder default when unset", () => {
    expect(getOrganizationPortalUrl()).toBe("https://your-org-portal.example.com");
  });
});
