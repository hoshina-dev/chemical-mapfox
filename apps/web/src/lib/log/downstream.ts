import "server-only";

import { logger, type LogLevel } from "./logger";
import { redact, safeUrl } from "./serialize";

export type DownstreamService =
  | "custapi"
  | "ticketing"
  | "experiment-manager"
  | "s3";

export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.url;
  }
  return String(input);
}

interface ExpectedStatusRule {
  service: DownstreamService;
  status: number;
  /**
   * Matched against the raw request URL, scoped to one endpoint shape (never
   * a loose substring) so the exemption can't silently swallow an unrelated
   * route that happens to share a path fragment.
   */
  urlPattern: RegExp;
}

/**
 * Downstream failures that are expected domain outcomes, not health
 * signals — muted here so they don't ALSO warn/error at the transport level
 * on top of the `info`-level log the calling action already writes via
 * `logHandledError` (see auth.ts `login`, users.ts `getUserById`). Keep this
 * table in sync with call sites that pass `expected: true`/`expected: <status
 * check>` to `logHandledError` for one of these services.
 */
const EXPECTED_STATUS_RULES: ExpectedStatusRule[] = [
  // Experiment context often does not exist yet (ticket created, EM not seeded).
  {
    service: "experiment-manager",
    status: 404,
    urlPattern: /\/api\/experiments\/[^/]+$/,
  },
  // Login / change-password verify against custapi — a 401 is the "wrong
  // password" path, not an outage.
  { service: "custapi", status: 401, urlPattern: /\/auth\/verify$/ },
  // Admin user-search lookup by id — a 404 is "no such user", logged by the
  // caller (getUserById). Excludes /users/search, which shares the prefix.
  {
    service: "custapi",
    status: 404,
    urlPattern: /\/users\/(?!search(?:$|\?))[^/]+$/,
  },
];

/**
 * Decide whether / at what level a downstream HTTP status should be logged.
 * `null` means skip — the status is an expected domain outcome.
 */
export function classifyDownstream(
  service: DownstreamService,
  url: string,
  status: number,
): LogLevel | null {
  if (status < 400) return null;

  const isExpected = EXPECTED_STATUS_RULES.some(
    (rule) =>
      rule.service === service &&
      rule.status === status &&
      rule.urlPattern.test(url),
  );
  if (isExpected) return null;

  if (status >= 500) return "error";
  return "warn";
}

/** Response bodies past this size are logged as a truncated string, never
 * parsed/redacted in full — keeps a single misbehaving downstream from
 * blowing up log-line size (and cost) during an incident. */
const MAX_BODY_CHARS = 4000;

export async function peekBody(res: Response): Promise<unknown> {
  try {
    const text = await res.clone().text();
    if (!text) return undefined;
    if (text.length > MAX_BODY_CHARS) {
      return `${text.slice(0, MAX_BODY_CHARS)}…[truncated ${text.length} chars]`;
    }
    try {
      return redact(JSON.parse(text));
    } catch {
      return text.slice(0, 500);
    }
  } catch {
    return undefined;
  }
}

export interface DownstreamInit extends RequestInit {
  /**
   * Abort the request after this many ms. Defaults per service (see
   * `DEFAULT_TIMEOUT_MS`). Pass a larger value for a call that legitimately
   * takes longer; there is deliberately no way to opt out entirely.
   */
  timeoutMs?: number;
}

/**
 * Every downstream request gets a deadline. Without one, a backend that
 * accepts the connection and then never answers — a wedged event loop, a
 * half-open socket — leaves the server action pending forever, and the page
 * that awaited it never renders. The failure is not the caller's to detect:
 * `fetch` will wait indefinitely by default.
 *
 * The interactive budget is short because these calls happen during a render
 * or a user action; s3 is generous because report downloads stream a whole
 * PDF through this wrapper and the deadline covers the body, not just the
 * response headers.
 */
const DEFAULT_TIMEOUT_MS: Record<DownstreamService, number> = {
  custapi: 10_000,
  ticketing: 10_000,
  "experiment-manager": 10_000,
  s3: 120_000,
};

/** A downstream that did not answer within its deadline. */
export class DownstreamTimeoutError extends Error {
  constructor(
    readonly service: DownstreamService,
    readonly timeoutMs: number,
  ) {
    super(`${service} did not respond within ${timeoutMs}ms`);
    this.name = "DownstreamTimeoutError";
  }
}

/**
 * fetch() wrapper used by every BFF → backend client. Applies the service's
 * deadline, logs unexpected statuses and network throws; leaves the Response
 * intact for the caller.
 */
export async function loggedFetch(
  service: DownstreamService,
  input: RequestInfo | URL,
  init?: DownstreamInit,
): Promise<Response> {
  const method = init?.method ?? "GET";
  const url = requestUrl(input);

  const { timeoutMs = DEFAULT_TIMEOUT_MS[service], signal, ...rest } = init ?? {};
  const deadline = AbortSignal.timeout(timeoutMs);
  // Honour a caller's own signal (route cancellation, React aborts) alongside
  // the deadline — whichever fires first wins.
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;

  try {
    const res = await fetch(input, { ...rest, signal: combined });
    const level = classifyDownstream(service, url, res.status);
    if (level) {
      logger[level](
        {
          service,
          method,
          url: safeUrl(url),
          status: res.status,
          body: await peekBody(res),
        },
        "downstream request failed",
      );
    }
    return res;
  } catch (err) {
    // The deadline fired: report it as a timeout rather than a bare AbortError,
    // so callers can map it to a gateway-timeout response and the log says what
    // actually happened.
    if (deadline.aborted && !signal?.aborted) {
      const timeout = new DownstreamTimeoutError(service, timeoutMs);
      logger.error(
        { err: timeout, service, method, url: safeUrl(url), timeoutMs },
        "downstream request timed out",
      );
      throw timeout;
    }
    logger.error(
      { err, service, method, url: safeUrl(url) },
      "downstream request threw",
    );
    throw err;
  }
}

export function createLoggedFetch(
  service: DownstreamService,
): typeof fetch {
  return (input, init) => loggedFetch(service, input, init);
}
