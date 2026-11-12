import { useTranslations } from "next-intl";
import { useCallback } from "react";

import {
  getCalculationInputsAction,
  saveCalculationResultsAction,
} from "@/app/actions/experiment";
import type { ActionResult } from "@/app/actions/experiment-manager";

import { CalculationEngineError, evaluateCalculations, firstFailure } from "./runner";

/** Localized message for a failure of the engine itself (not of a formula). */
export function useEngineErrorMessage(): (error: CalculationEngineError) => string {
  const t = useTranslations("common.calculationEngine");
  return useCallback((error) => t(error.code, { detail: error.message }), [t]);
}

/** Next rejects Server Action bodies over 1 MB; leave room for the envelope. */
const MAX_SAVE_BYTES = 900_000;

/**
 * Browser counterpart of experiment-manager's `POST /experiments/{id}/calculate`:
 * the same inputs, the same first error, and the results saved the same way.
 */
export async function calculateExperiment(
  contextId: string,
  engineErrorMessage: (error: CalculationEngineError) => string,
): Promise<ActionResult<null>> {
  try {
    return await calculate(contextId, engineErrorMessage);
  } catch (error) {
    // A Server Action request can be rejected outright (size, network).
    return { success: false, error: engineErrorMessage(new CalculationEngineError("save", String(error))) };
  }
}

async function calculate(
  contextId: string,
  engineErrorMessage: (error: CalculationEngineError) => string,
): Promise<ActionResult<null>> {
  const inputs = await getCalculationInputsAction(contextId);
  if (!inputs.success) return inputs;
  const { experimentJson, fingerprint } = inputs.data;

  let evaluation;
  try {
    evaluation = await evaluateCalculations(experimentJson);
  } catch (error) {
    if (error instanceof CalculationEngineError) {
      return { success: false, error: engineErrorMessage(error) };
    }
    throw error;
  }

  const failure = firstFailure(evaluation.report);
  if (failure) return { success: false, error: failure };

  const { valuesJson, calculationsJson } = evaluation;
  // As sent: the action request JSON-escapes these strings again.
  const payload = JSON.stringify([fingerprint, valuesJson, calculationsJson]);
  const size = new TextEncoder().encode(payload).length;
  if (size > MAX_SAVE_BYTES) {
    return { success: false, error: engineErrorMessage(new CalculationEngineError("tooLarge", "")) };
  }
  return saveCalculationResultsAction(contextId, { fingerprint, valuesJson, calculationsJson });
}
