import { afterEach, describe, expect, it } from "vitest";

import { createS3ClientConfig } from "./client";

describe("createS3ClientConfig", () => {
  afterEach(() => {
    delete process.env.S3_REGION;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_ACCESS_KEY;
    delete process.env.S3_SECRET_KEY;
  });

  it("omits static credentials so AWS execution roles can be used", () => {
    expect(createS3ClientConfig()).toEqual({});
  });

  it("uses the AWS-compatible auto region for endpoint-based S3 providers", () => {
    process.env.S3_ENDPOINT = "https://example.r2.cloudflarestorage.com";

    expect(createS3ClientConfig()).toEqual({
      endpoint: "https://example.r2.cloudflarestorage.com",
      region: "auto",
    });
  });

  it("keeps explicit region settings when provided", () => {
    process.env.S3_REGION = "us-east-1";
    process.env.S3_ENDPOINT = "https://s3.us-east-1.amazonaws.com";
    process.env.S3_ACCESS_KEY = "access-key";
    process.env.S3_SECRET_KEY = "secret-key";

    expect(createS3ClientConfig()).toEqual({
      region: "us-east-1",
      endpoint: "https://s3.us-east-1.amazonaws.com",
      credentials: {
        accessKeyId: "access-key",
        secretAccessKey: "secret-key",
      },
    });
  });
});