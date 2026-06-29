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
}

function createMock(): Redis {
  // Loaded lazily so production bundles never pull in ioredis-mock.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RedisMock = require("ioredis-mock") as { default: new () => Redis };
  return new RedisMock.default();
}

export function getMockRedisClient(): Redis {
  return (globalThis.__chemfoxRedisMockClient ??= createMock());
}

export function getMockRedisSubscriber(): Redis {
  return (globalThis.__chemfoxRedisMockSubscriber ??= createMock());
}
