import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emFetch, ExperimentManagerError } from "./client";

/**
 * A downstream that never responds must not hang the caller forever. A
 * long-running calculation (a runaway formula blocks experiment-manager's
 * event loop) otherwise leaves the server action pending indefinitely, and the
 * builder's "Test calculations" button spins with no way out.
 */
describe("emFetch timeout", () => {
  beforeEach(() => {
    vi.stubEnv("EXPERIMENT_MANAGER_URL", "http://em.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects with a 504 ExperimentManagerError when the response never arrives", async () => {
    // A fetch that only settles when its abort signal fires — i.e. a downstream
    // that has stopped responding entirely.
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      }),
    );

    const error = await emFetch("/api/calculations/evaluate", {
      method: "POST",
      body: "{}",
      timeoutMs: 50,
    }).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ExperimentManagerError);
    expect((error as ExperimentManagerError).status).toBe(504);
  });

  it("passes an abort signal to fetch so the request is actually cancelled", async () => {
    const seen: (AbortSignal | null | undefined)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        seen.push(init?.signal);
        return Promise.resolve(
          new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }),
    );

    await emFetch("/api/samples", { timeoutMs: 1000 });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(AbortSignal);
  });
});
