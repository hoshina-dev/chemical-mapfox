/**
 * Contract for a backend-stub module. Each feature area can drop a file in
 * `stub/modules/` that registers one of these — the server auto-loads every
 * module in that directory, so adding a feature never means editing a shared
 * file (keeps parallel branches conflict-free).
 */

export interface StubContext {
  method: string;
  /** Path segments with the shared `/api/v1` prefix stripped. */
  path: string[];
  url: URL;
  /** Parse and cache the JSON request body. */
  readBody(): Promise<unknown>;
  /** Send a JSON response. Returns `true` so handlers can `return ctx.json(...)`. */
  json(status: number, body: unknown): true;
}

export interface StubModule {
  /** Unique, human-readable name (used in logs). */
  name: string;
  /** Reset any module-local in-memory state before each scenario. */
  reset?(): void;
  /** Handle the request; return `true` if it was handled, else `false`. */
  handle(ctx: StubContext): boolean | Promise<boolean>;
}
