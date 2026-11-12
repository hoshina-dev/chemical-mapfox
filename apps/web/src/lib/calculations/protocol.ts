import type { CalculationDryRunResponse } from "@/lib/experiment-manager/client";

/** `load`: Pyodide failed to start. `timeout`: a formula ran too long. */
export type CalculationEngineErrorCode = "load" | "timeout" | "engine";

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

export interface WorkerRequest {
  id: number;
  /** A dry-run request (or a stored experiment) as JSON text. */
  body: string;
}

export type WorkerReply =
  | { id: number; type: "started" }
  | { id: number; type: "done"; evaluation: Evaluation }
  | { id: number; type: "error"; code: CalculationEngineErrorCode; detail: string };
