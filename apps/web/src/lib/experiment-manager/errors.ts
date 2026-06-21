import { ExperimentManagerError } from "./client";

interface ValidationItem {
  loc?: unknown[];
  msg?: string;
}

function formatValidationItem(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const { loc, msg } = item as ValidationItem;
  const message = typeof msg === "string" ? msg : "";
  if (!message) return null;
  const path = Array.isArray(loc)
    ? loc.filter((p) => p !== "body" && typeof p === "string").join(".")
    : "";
  return path ? `${path}: ${message}` : message;
}

/**
 * experiment-manager surfaces errors in a few shapes:
 *  - FastAPI request validation:  { detail: [{ loc, msg, type }, ...] }
 *  - template schema check:       { detail: { message, errors: string[] } }
 *  - handled errors:              { detail: "..." }
 * Flatten any of them into a readable, multi-line message (no truncation).
 */
function formatDetail(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const detail = record.detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map(formatValidationItem)
      .filter((m): m is string => Boolean(m));
    if (messages.length) return messages.join("\n");
  }

  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const inner = detail as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof inner.message === "string" && inner.message.trim()) {
      parts.push(inner.message.trim());
    }
    if (Array.isArray(inner.errors)) {
      for (const err of inner.errors) {
        if (typeof err === "string" && err.trim()) parts.push(`• ${err.trim()}`);
      }
    }
    if (parts.length) return parts.join("\n");
  }

  if (typeof detail === "string" && detail.trim()) return detail.trim();

  for (const key of ["error", "message"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  try {
    const raw = JSON.stringify(body);
    if (raw && raw !== "{}") return raw;
  } catch {
    /* not serializable */
  }
  return null;
}

/** Turn an experiment-manager failure into a friendly, multi-line message. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ExperimentManagerError) {
    const detail = formatDetail(error.body);
    if (detail) return `${fallback}\n${detail}`;
    if (typeof error.body === "string" && error.body.trim()) {
      return `${fallback}\n${error.body.trim()}`;
    }
    return `${fallback} (${error.status})`;
  }
  return fallback;
}
