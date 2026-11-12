import type {
  CalculationDryRunRequest,
  CalculationDryRunResponse,
} from "@/lib/experiment-manager/client";

import type {
  CalculationEngineErrorCode,
  Evaluation,
  WorkerReply,
  WorkerRequest,
} from "./protocol";

/**
 * experiment-manager's sandbox wall-clock limit (`calc_sandbox_settings`; it
 * also caps CPU at 2 s). Pyodide is slower than CPython, so a formula near the
 * limit may pass on one side only.
 */
const RUN_TIMEOUT_MS = 5_000;
/** First use downloads ~13 MB of Pyodide. */
const LOAD_TIMEOUT_MS = 60_000;

export class CalculationEngineError extends Error {
  constructor(
    readonly code: CalculationEngineErrorCode,
    detail: string,
  ) {
    super(detail);
    this.name = "CalculationEngineError";
  }
}

let worker: Worker | null = null;
let nextId = 0;
let queue: Promise<unknown> = Promise.resolve();

function getWorker(): Worker {
  worker ??= new Worker(new URL("./calc.worker.ts", import.meta.url), {
    type: "module",
  });
  return worker;
}

function run(body: string): Promise<Evaluation> {
  const id = ++nextId;
  const current = getWorker();
  return new Promise((resolve, reject) => {
    let timer = setTimeout(() => fail("load", "Timed out loading Pyodide"), LOAD_TIMEOUT_MS);

    function settle() {
      clearTimeout(timer);
      current.removeEventListener("message", onMessage);
      current.removeEventListener("error", onError);
    }
    function fail(code: CalculationEngineErrorCode, detail: string) {
      settle();
      // A runaway formula can't be interrupted, only killed with its worker.
      if (code !== "engine") {
        current.terminate();
        worker = null;
      }
      reject(new CalculationEngineError(code, detail));
    }
    function onError(event: ErrorEvent) {
      fail("load", event.message);
    }
    function onMessage({ data }: MessageEvent<WorkerReply>) {
      if (data.id !== id) return;
      if (data.type === "started") {
        clearTimeout(timer);
        timer = setTimeout(() => fail("timeout", "Calculation timed out"), RUN_TIMEOUT_MS);
      } else if (data.type === "done") {
        settle();
        resolve(data.evaluation);
      } else {
        fail(data.code, data.detail);
      }
    }

    current.addEventListener("message", onMessage);
    current.addEventListener("error", onError);
    current.postMessage({ id, body } satisfies WorkerRequest);
  });
}

/**
 * Evaluate formulas in the browser, with the same contract as
 * experiment-manager's `POST /api/calculations/evaluate`. Pyodide is fetched
 * on the first call only, so pages that never calculate never load it. Pass
 * stored data as JSON text so Python sees its floats as floats.
 */
export function evaluateCalculations(
  request: CalculationDryRunRequest | string,
): Promise<Evaluation> {
  const body = typeof request === "string" ? request : JSON.stringify(request);
  const result = queue.then(() => run(body));
  queue = result.catch(() => undefined);
  return result;
}

/**
 * The error `POST /experiments/{id}/calculate` would have raised for this
 * report: a cycle first, else the first failure in evaluation order.
 */
export function firstFailure(report: CalculationDryRunResponse): string | null {
  const outcomes = Object.values(report.calculations);
  const circular = outcomes.find((outcome) => outcome.error?.kind === "circular");
  if (circular?.error) return circular.error.message;
  for (const name of report.order) {
    const outcome = report.calculations[name];
    if (outcome?.status !== "ok") return outcome?.error?.message ?? name;
  }
  return null;
}
