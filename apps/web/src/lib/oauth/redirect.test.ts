import { describe, expect, it } from "vitest";

import {
  isAllowedRedirectUri,
  isKnownAiRedirect,
  redirectHost,
} from "./redirect";

describe("isAllowedRedirectUri", () => {
  it("accepts any https URI, including unknown assistant hosts", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(
      true,
    );
    expect(isAllowedRedirectUri("https://evil.example/cb")).toBe(true);
    expect(isAllowedRedirectUri("https://127.0.0.1/cb")).toBe(true);
  });

  it("accepts loopback http only", () => {
    expect(isAllowedRedirectUri("http://localhost/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:6274/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://[::1]/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://[::1]:8080/cb")).toBe(true);
  });

  it("rejects non-loopback http, other schemes, fragments, userinfo, and garbage", () => {
    expect(isAllowedRedirectUri("http://example.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("http://localhost.evil.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("ftp://localhost/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://claude.ai/cb#fragment")).toBe(false);
    expect(isAllowedRedirectUri("https://user@claude.ai/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://user:pass@claude.ai/cb")).toBe(false);
    expect(isAllowedRedirectUri("not a url")).toBe(false);
    expect(isAllowedRedirectUri("https://")).toBe(false);
    expect(isAllowedRedirectUri("/relative")).toBe(false);
    expect(isAllowedRedirectUri("")).toBe(false);
  });
});

describe("redirectHost", () => {
  it("returns the host, including port when present", () => {
    expect(redirectHost("https://claude.ai/api/mcp/auth_callback")).toBe(
      "claude.ai",
    );
    expect(redirectHost("http://localhost:6274/cb")).toBe("localhost:6274");
  });
});

describe("isKnownAiRedirect", () => {
  it("accepts claude.ai, chatgpt.com, and their subdomains over https", () => {
    expect(isKnownAiRedirect("https://claude.ai/cb")).toBe(true);
    expect(isKnownAiRedirect("https://www.claude.ai/cb")).toBe(true);
    expect(isKnownAiRedirect("https://chatgpt.com/cb")).toBe(true);
    expect(isKnownAiRedirect("https://auth.chatgpt.com/cb")).toBe(true);
  });

  it("rejects lookalikes, other hosts, and http", () => {
    expect(isKnownAiRedirect("https://evilclaude.ai/cb")).toBe(false);
    expect(isKnownAiRedirect("https://claude.ai.evil.com/cb")).toBe(false);
    expect(isKnownAiRedirect("https://chatgpt.com.evil.com/cb")).toBe(false);
    expect(isKnownAiRedirect("https://example.com/cb")).toBe(false);
    expect(isKnownAiRedirect("http://claude.ai/cb")).toBe(false);
    expect(isKnownAiRedirect("http://localhost/cb")).toBe(false);
  });
});
