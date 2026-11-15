import { useTranslations } from "next-intl";
import { useCallback } from "react";

import {
  finishExperimentAction,
  finishInputsAction,
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
 * Finish an experiment: save the editor's buffer and read the stored experiment,
 * run its formulas in the browser engine, then finish with the results.
 * `room` is the collaborative editor's `{ticketId}_{experimentId}`.
 */
export async function finishWithCalculations(
  room: string,
  engineErrorMessage: (error: CalculationEngineError) => string,
): Promise<ActionResult<null>> {
  try {
    const inputs = await finishInputsAction(room);
    if (!inputs.success) return inputs;
    let evaluation;
    try {
      evaluation = await evaluateCalculations(inputs.data.experimentJson);
    } catch (error) {
      if (error instanceof CalculationEngineError) {
        return { success: false, error: engineErrorMessage(error) };
      }
      throw error;
    }
    const failure = firstFailure(evaluation.report);
    if (failure) return { success: false, error: failure };
    const { calculationsJson } = evaluation;
    // As sent: the action request JSON-escapes this string again.
    const payload = JSON.stringify([room, inputs.data.version, calculationsJson]);
    if (new TextEncoder().encode(payload).length > MAX_SAVE_BYTES) {
      return { success: false, error: engineErrorMessage(new CalculationEngineError("tooLarge", "")) };
    }
    return await finishExperimentAction(room, inputs.data.version, calculationsJson);
  } catch (error) {
    // A Server Action request can be rejected outright (size, network).
    return { success: false, error: engineErrorMessage(new CalculationEngineError("save", String(error))) };
  }
}
