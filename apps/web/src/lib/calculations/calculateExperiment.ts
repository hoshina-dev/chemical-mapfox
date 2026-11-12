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

/**
 * Browser counterpart of experiment-manager's `POST /experiments/{id}/calculate`:
 * the same inputs, the same first error, and the results saved the same way.
 */
export async function calculateExperiment(
  contextId: string,
  engineErrorMessage: (error: CalculationEngineError) => string,
): Promise<ActionResult<null>> {
  const inputs = await getCalculationInputsAction(contextId);
  if (!inputs.success) return inputs;
  const { experimentJson, values } = inputs.data;

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

  return saveCalculationResultsAction(contextId, {
    startedFrom: values,
    valuesJson: evaluation.valuesJson,
    calculationsJson: evaluation.calculationsJson,
  });
}
