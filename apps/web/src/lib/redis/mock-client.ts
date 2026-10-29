import "server-only";

import type Redis from "ioredis";

/**
 * In-memory Redis for acceptance tests (`E2E_REDIS_MOCK=1`). Uses two
 * ioredis-mock instances (command + subscriber) so pub/sub and normal commands
 * don't share subscriber mode on one connection — same pattern as real Redis
 * and the ioredis-mock README.
 */
declare global {
  var __chemfoxRedisMockClient: Redis | undefined;
  var __chemfoxRedisMockSubscriber: Redis | undefined;
  var __chemfoxRedisMockCtor: (new () => Redis) | undefined;
}

function createMock(): Redis {
  // Loaded lazily so production bundles never pull in ioredis-mock. The
  // constructor is shared via globalThis because the proxy and the app routes
  // are separate bundles, each with its own copy of the module, and pub/sub
  // only reaches instances created from the same copy.
  globalThis.__chemfoxRedisMockCtor ??= (
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("ioredis-mock") as { default: new () => Redis }
  ).default;
  return new globalThis.__chemfoxRedisMockCtor();
}

export function getMockRedisClient(): Redis {
  return (globalThis.__chemfoxRedisMockClient ??= createMock());
}

export function getMockRedisSubscriber(): Redis {
  return (globalThis.__chemfoxRedisMockSubscriber ??= createMock());
}
