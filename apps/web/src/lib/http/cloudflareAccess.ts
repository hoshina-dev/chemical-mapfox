import "server-only";

const BACKEND_SERVICES = new Set([
  "custapi",
  "ticketing",
  "experiment-manager",
]);

function trimmedEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function accessClientId(): string | undefined {
  return trimmedEnv(process.env.CF_ACCESS_CLIENT_ID);
}

function accessClientSecret(): string | undefined {
  return trimmedEnv(process.env.CF_ACCESS_CLIENT_SECRET);
}

/**
 * Cloudflare Access service-token credentials are a local-dev escape hatch
 * so `next dev` can reach production backends behind a tunnel. They must
 * never be present when NODE_ENV is production (the Docker image sets that
 * unconditionally).
 */
export function assertCloudflareAccessNotInProduction(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (accessClientId() || accessClientSecret()) {
    throw new Error(
      "CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET must not be set when NODE_ENV=production",
    );
  }
}

export function cloudflareAccessConfigured(): boolean {
  return Boolean(accessClientId() || accessClientSecret());
}

/**
 * Headers to attach on BFF → backend fetches. Returns `undefined` when the
 * service-token env vars are unset, or for services that are not behind
 * Cloudflare Access (S3/R2 presigned URLs).
 *
 * Never returns headers in production — and throws if the credentials were
 * supplied there, so a misconfigured deploy cannot silently "work".
 */
export function cloudflareAccessHeaders(
  service: string,
): Record<string, string> | undefined {
  assertCloudflareAccessNotInProduction();
  if (process.env.NODE_ENV === "production") return undefined;
  if (!BACKEND_SERVICES.has(service)) return undefined;

  const id = accessClientId();
  const secret = accessClientSecret();
  if (!id && !secret) return undefined;
  if (!id || !secret) {
    throw new Error(
      "CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET must both be set to reach Cloudflare Access-protected backends",
    );
  }

  return {
    "CF-Access-Client-Id": id,
    "CF-Access-Client-Secret": secret,
  };
}
