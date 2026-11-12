import type { CalculationDryRunResponse } from "@/lib/experiment-manager/client";

/**
 * `load`: Pyodide failed to start. `timeout`: a formula ran too long.
 * `tooLarge`: the results can't be sent. `save`: a server request failed.
 */
export type CalculationEngineErrorCode = "load" | "timeout" | "engine" | "tooLarge" | "save";

export interface Evaluation {
  report: CalculationDryRunResponse;
  /**
   * What to save, as Python wrote it so 5.0 stays 5.0: the values with
   * defaults filled in, and `{name: {formula, result}}` for each formula that
   * succeeded.
   */
  valuesJson: string;
  calculationsJson: string;
}

/** Page → sandbox frame. */
export type SandboxCommand =
  /** A dry-run request (or a stored experiment) as JSON text. */
  | { id: number; body: string }
  | { cancel: number };

/** Sandbox frame → page. `out` is the engine's JSON text, still untrusted. */
export type SandboxReply =
  | { type: "booted" }
  | { id: number; type: "started" }
  | { id: number; type: "done"; out: string }
  | { id: number; type: "error"; code: CalculationEngineErrorCode; detail: string };
