import "server-only";

const SENSITIVE_KEY =
  /pass(word|wd)|secret|token|authorization|cookie|set-cookie|jwt|api[_-]?key|access[_-]?key|refresh/i;

const MAX_DEPTH = 6;

/** Strip query/hash so presigned URLs and tokens never land in logs. */
export function safeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    const cut = url.split(/[?#]/, 1)[0];
    return cut || url;
  }
}

export function httpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("status" in error && typeof error.status === "number") {
    return error.status;
  }
  if ("response" in error && error.response instanceof Response) {
    return error.response.status;
  }
  return undefined;
}

export function redact(value: unknown, depth = 0, seen?: WeakSet<object>): unknown {
  if (value === null || typeof value !== "object") return value;

  const seenSet = seen ?? new WeakSet<object>();
  if (seenSet.has(value)) return "[Circular]";
  if (depth > MAX_DEPTH) return "[Truncated]";

  if (value instanceof Date) return value.toISOString();
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return `[Buffer ${value.length}]`;
  }

  seenSet.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1, seenSet));
  }

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key)
      ? "[Redacted]"
      : redact(nested, depth + 1, seenSet);
  }
  return out;
}

export function serializeError(
  error: unknown,
  depth = 0,
  seen?: WeakSet<object>,
): Record<string, unknown> {
  if (error instanceof Error) {
    const seenSet = seen ?? new WeakSet<object>();
    if (seenSet.has(error)) return { message: "[Circular]" };
    if (depth > MAX_DEPTH) return { message: "[Truncated]" };
    seenSet.add(error);

    const serialized: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };
    if (error.stack) serialized.stack = error.stack;

    const status = httpStatus(error);
    if (status !== undefined) serialized.status = status;

    if ("body" in error) {
      serialized.body = redact(error.body);
    }

    if ("response" in error && error.response instanceof Response) {
      serialized.url = safeUrl(error.response.url);
    }

    if (error.cause !== undefined) {
      serialized.cause = serializeError(error.cause, depth + 1, seenSet);
    }

    return serialized;
  }

  if (error && typeof error === "object") {
    return redact(error) as Record<string, unknown>;
  }

  return { message: String(error) };
}
