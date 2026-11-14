import type { CalculationDryRunRequest } from "@/lib/experiment-manager/client";

import type { CalculationEngineErrorCode, Evaluation, SandboxReply } from "./protocol";
import { createSandbox, type Sandbox } from "./sandbox";

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

let sandbox: Sandbox | null = null;
let nextId = 0;
let queue: Promise<unknown> = Promise.resolve();

const STATUSES = new Set(["ok", "error", "skipped"]);
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

function isOutcome(value: unknown): boolean {
  const outcome = value as { formula?: unknown; status?: unknown; error?: unknown } | null;
  if (typeof outcome?.formula !== "string" || !STATUSES.has(outcome.status as string)) return false;
  const error = outcome.error as { kind?: unknown; message?: unknown } | null | undefined;
  return error == null || (typeof error.kind === "string" && typeof error.message === "string");
}

/** The frame's reply is untrusted: an escaped formula can write anything the UI renders. */
function parseEvaluation(out: string): Evaluation | null {
  try {
    const { report, values, calculations } = JSON.parse(out) as Record<string, unknown>;
    const shape = report as Record<string, unknown> | null;
    const outcomes = shape?.calculations;
    const ok =
      typeof outcomes === "object" &&
      outcomes !== null &&
      Object.values(outcomes).every(isOutcome) &&
      isStrings(shape?.order) &&
      isStrings(shape?.missing_values) &&
      isStrings(shape?.duplicate_question_ids) &&
      typeof shape?.values === "object" &&
      typeof values === "string" &&
      typeof calculations === "string";
    return ok
      ? { report: report as Evaluation["report"], valuesJson: values, calculationsJson: calculations }
      : null;
  } catch {
    return null;
  }
}

function run(body: string): Promise<Evaluation> {
  const id = ++nextId;
  sandbox ??= createSandbox();
  const current = sandbox;
  return new Promise((resolve, reject) => {
    let started = false;
    let timer = setTimeout(() => fail("load", "Timed out loading Pyodide"), LOAD_TIMEOUT_MS);
    const unsubscribe = current.onReply(onReply);

    function settle() {
      clearTimeout(timer);
      unsubscribe();
    }
    function fail(code: CalculationEngineErrorCode, detail: string) {
      settle();
      if (code === "load") {
        // The frame itself may be broken; start over next time.
        current.dispose();
        sandbox = null;
      } else {
        current.post({ cancel: id });
      }
      reject(new CalculationEngineError(code, detail));
    }
    function onReply(reply: SandboxReply) {
      if (!("id" in reply) || reply.id !== id) return;
      if (reply.type === "started") {
        // Only the first one starts the deadline; a formula can't extend it.
        if (started) return;
        started = true;
        clearTimeout(timer);
        timer = setTimeout(() => fail("timeout", "Calculation timed out"), RUN_TIMEOUT_MS);
      } else if (reply.type === "done") {
        const evaluation = parseEvaluation(reply.out);
        if (!evaluation) return fail("engine", "Malformed engine reply");
        settle();
        resolve(evaluation);
      } else {
        fail(reply.code === "load" ? "load" : "engine", String(reply.detail));
      }
    }

    current.post({ id, body });
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
export function firstFailure(report: Evaluation["report"]): string | null {
  const outcomes = Object.values(report.calculations);
  const circular = outcomes.find((outcome) => outcome.error?.kind === "circular");
  if (circular?.error) return circular.error.message;
  for (const name of report.order) {
    const outcome = report.calculations[name];
    if (outcome?.status !== "ok") return outcome?.error?.message ?? name;
  }
  return null;
}
