"use client";

import type { ExperimentTemplate, FormAnswers } from "@repo/forms";
import { useCallback, useEffect, useRef, useState } from "react";

import { useEngineErrorMessage } from "@/lib/calculations/calculateExperiment";
import { CalculationEngineError, evaluateCalculations } from "@/lib/calculations/runner";
import type { DishRunState } from "@/lib/forms/dishRun";
import { resolveDishRun } from "@/lib/forms/dishRunResolve";

export interface DishRunSession {
  /** The last computed state, or `null` before the first check finishes. */
  state: DishRunState | null;
  pending: boolean;
  /** Dish values have changed since `state` was computed. */
  stale: boolean;
  /** The engine itself failed (not a formula) — already translated. */
  error: string | null;
  /** Evaluate now. */
  check: () => void;
}

/**
 * The dish-run decision for the lab-form editor, computed on request.
 *
 * The formulas run through the same browser engine that computes the results
 * stored on finish, so what the panel shows is what the certificate prints.
 * Evaluation is explicit rather than automatic on every keystroke: a run loads
 * Pyodide and takes real time.
 */
export function useDishRun(
  template: ExperimentTemplate,
  values: FormAnswers,
  enabled: boolean,
): DishRunSession {
  const [state, setState] = useState<DishRunState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedKey, setCheckedKey] = useState<string | null>(null);
  const sequence = useRef(0);
  const engineErrorMessage = useEngineErrorMessage();

  const doc = template.labForm;
  const dishRun = doc.dishRun;

  // A signature of just the dish columns: editing an unrelated lab field must
  // not mark the decision stale.
  const group = dishRun
    ? doc.questions.find(
        (question) => question.id === dishRun.group && question.type === "repeatable-group",
      )
    : undefined;
  const key =
    group && group.type === "repeatable-group"
      ? JSON.stringify(group.config.questions.map((child) => values[child.id] ?? null))
      : "";

  const check = useCallback(() => {
    if (!enabled || !dishRun) return;
    const mine = ++sequence.current;
    const evaluated = key;
    setPending(true);
    void resolveDishRun(template, values, async (request) => {
      const { report } = await evaluateCalculations(request);
      return report;
    })
      .then((next) => {
        if (mine !== sequence.current) return;
        setState(next);
        setCheckedKey(evaluated);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (mine !== sequence.current) return;
        if (!(cause instanceof CalculationEngineError)) throw cause;
        setError(engineErrorMessage(cause));
      })
      .finally(() => {
        if (mine === sequence.current) setPending(false);
      });
    // `values` is read through the closure on purpose: `key` already tracks the
    // dish columns, and an unrelated lab edit must not rebuild `check`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, enabled, dishRun, key, engineErrorMessage]);

  const checkedOnce = useRef(false);
  useEffect(() => {
    if (!enabled || !dishRun || checkedOnce.current) return;
    checkedOnce.current = true;
    check();
  }, [enabled, dishRun, check]);

  return {
    state,
    pending,
    stale: state !== null && checkedKey !== key,
    error,
    check,
  };
}
