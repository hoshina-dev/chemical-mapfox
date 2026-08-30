/**
 * Next.js instrumentation: process start + uncaught server errors
 * (RSC render, route handlers, server actions, proxy).
 *
 * Node-only logger is dynamically imported so the Edge bundle for `proxy.ts`
 * does not pull in `server-only` / stdout streams. The edge branch below
 * still shares `buildLogRecord` (record.ts, no "server-only") so its JSON
 * shape can't drift from what the Node `Logger` produces.
 */
import { buildLogRecord } from "./lib/log/record";

function header(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logger } = await import("./lib/log/logger");
  logger.info("web bff started");
}

export async function onRequestError(
  error: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
  },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
    renderSource?: string;
  },
): Promise<void> {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest: unknown }).digest)
      : undefined;
  const requestId =
    header(request.headers, "x-request-id") ??
    header(request.headers, "cf-ray");

  if (process.env.NEXT_RUNTIME === "edge") {
    console.error(
      JSON.stringify(
        buildLogRecord(
          "error",
          {
            app: "web",
            path: request.path,
            method: request.method,
            routePath: context.routePath,
            routeType: context.routeType,
            digest,
            requestId,
            err:
              error instanceof Error
                ? { name: error.name, message: error.message }
                : { message: String(error) },
          },
          "unhandled request error",
        ),
      ),
    );
    return;
  }

  const { logger } = await import("./lib/log/logger");
  logger.error(
    {
      err: error,
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      digest,
      requestId,
    },
    "unhandled request error",
  );
}
