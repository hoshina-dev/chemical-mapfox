import type { AnswerValue, Calculation, FormDoc } from "@repo/forms";

// The calculation engine's request and report (Pyodide in the browser; the shape
// matches the experiment schema's calculations).

/** A draft template plus trial answers, evaluated without saving anything. */
export interface CalculationDryRunRequest {
  clientForm?: FormDoc | null;
  labForm?: FormDoc | null;
  calculations: Record<string, Calculation>;
  values?: Record<string, AnswerValue | unknown>;
}

export interface CalculationError {
  kind: string;
  message: string;
  names?: string[];
}

export interface CalculationOutcome {
  formula: string;
  status: "ok" | "error" | "skipped";
  result?: unknown;
  error?: CalculationError | null;
}

export interface CalculationDryRunResponse {
  values: Record<string, unknown>;
  /** Evaluation order (dependencies first). */
  order: string[];
  calculations: Record<string, CalculationOutcome>;
  missing_values: string[];
  duplicate_question_ids: string[];
}
