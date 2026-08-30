import "server-only";

import { logger, type LogLevel } from "./logger";

export interface HandledErrorContext {
  /** Server action name, e.g. `login`. */
  action?: string;
  /** Non-action operation, e.g. `collab.hydrate`. */
  op?: string;
  service?: "custapi" | "ticketing" | "experiment-manager" | "s3" | "redis";
  /**
   * Expected domain failure (bad credentials, missing resource, validation).
   * Logged at `info` so it does not page as an outage.
   */
  expected?: boolean;
  /** Override the default level (`expected` → info, otherwise error). */
  level?: LogLevel;
  contextId?: string;
  userId?: string;
  sampleId?: string;
  status?: number;
}

/**
 * Record an error that a BFF handler caught and turned into a user-facing
 * result (form message, empty list, 4xx). Uncaught errors go through
 * `instrumentation.ts` `onRequestError` instead.
 */
export function logHandledError(
  error: unknown,
  context: HandledErrorContext,
): void {
  const { expected, level: levelOverride, ...fields } = context;
  const level: LogLevel =
    levelOverride ?? (expected ? "info" : "error");
  logger[level](
    { err: error, ...fields, expected: expected ?? false },
    expected ? "handled expected error" : "handled error",
  );
}

/**
 * `warn` for a definite client error, `error` for a server failure or an
 * unknown/missing status (network throw, non-HTTP error). Shared by every
 * handler that classifies a downstream failure by its HTTP status instead of
 * hardcoding the same `status < 500` ternary at each call site.
 */
export function levelForStatus(status: number | undefined): LogLevel {
  return status !== undefined && status < 500 ? "warn" : "error";
}
