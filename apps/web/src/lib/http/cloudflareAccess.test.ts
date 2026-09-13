import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertCloudflareAccessNotInProduction,
  cloudflareAccessConfigured,
  cloudflareAccessHeaders,
} from "./cloudflareAccess";

const ENV_KEYS = [
  "NODE_ENV",
  "CF_ACCESS_CLIENT_ID",
  "CF_ACCESS_CLIENT_SECRET",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  delete process.env.CF_ACCESS_CLIENT_ID;
  delete process.env.CF_ACCESS_CLIENT_SECRET;
  process.env.NODE_ENV = "development";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("cloudflareAccessHeaders", () => {
  it("returns nothing when credentials are unset", () => {
    expect(cloudflareAccessConfigured()).toBe(false);
    expect(cloudflareAccessHeaders("custapi")).toBeUndefined();
  });

  it("attaches both Access headers on backend services in development", () => {
    process.env.CF_ACCESS_CLIENT_ID = " client-id ";
    process.env.CF_ACCESS_CLIENT_SECRET = " client-secret ";

    expect(cloudflareAccessConfigured()).toBe(true);
    expect(cloudflareAccessHeaders("custapi")).toEqual({
      "CF-Access-Client-Id": "client-id",
      "CF-Access-Client-Secret": "client-secret",
    });
    expect(cloudflareAccessHeaders("ticketing")).toMatchObject({
      "CF-Access-Client-Id": "client-id",
    });
    expect(cloudflareAccessHeaders("experiment-manager")).toMatchObject({
      "CF-Access-Client-Secret": "client-secret",
    });
  });

  it("does not attach Access headers to S3 fetches", () => {
    process.env.CF_ACCESS_CLIENT_ID = "client-id";
    process.env.CF_ACCESS_CLIENT_SECRET = "client-secret";

    expect(cloudflareAccessHeaders("s3")).toBeUndefined();
  });

  it("throws when only one credential is set", () => {
    process.env.CF_ACCESS_CLIENT_ID = "client-id";

    expect(() => cloudflareAccessHeaders("custapi")).toThrow(
      /must both be set/,
    );
  });

  it("never returns headers in production and throws if credentials leaked in", () => {
    process.env.NODE_ENV = "production";
    process.env.CF_ACCESS_CLIENT_ID = "client-id";
    process.env.CF_ACCESS_CLIENT_SECRET = "client-secret";

    expect(() => cloudflareAccessHeaders("custapi")).toThrow(
      /must not be set when NODE_ENV=production/,
    );
    expect(() => assertCloudflareAccessNotInProduction()).toThrow(
      /must not be set when NODE_ENV=production/,
    );
  });

  it("is a no-op in production when credentials are unset", () => {
    process.env.NODE_ENV = "production";

    expect(() => assertCloudflareAccessNotInProduction()).not.toThrow();
    expect(cloudflareAccessHeaders("custapi")).toBeUndefined();
  });
});
