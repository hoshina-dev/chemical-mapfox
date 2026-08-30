/**
 * Pure JSON-log-record shaping, with no "server-only" / Node stream
 * dependency, so it can be shared by the Node `Logger` (logger.ts) and the
 * Edge-runtime branch of `instrumentation.ts`'s `onRequestError` — keeping
 * both producing the same record shape instead of the edge path hand-rolling
 * its own copy that can drift out of sync.
 */
export function buildLogRecord(
  level: string,
  fields: Record<string, unknown>,
  msg: string,
): Record<string, unknown> {
  return {
    ...fields,
    level,
    time: new Date().toISOString(),
    msg,
  };
}
