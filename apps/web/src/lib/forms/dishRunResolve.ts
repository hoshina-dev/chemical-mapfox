import type { AnswerValue, ExperimentTemplate } from "@repo/forms";

import type {
  CalculationDryRunRequest,
  CalculationDryRunResponse,
} from "@/lib/calculations/types";
import { templateToCalculationDryRun } from "@/lib/experiment/templates";
import {
  activeDishCount,
  normalizeDishColumns,
  readDishGroup,
  touchedDishes,
} from "@/lib/forms/dishColumns";
import { finalCalcName } from "@/lib/forms/dishFormula";
import {
  type DishRunIssue,
  type DishRunState,
  evaluateDishRun,
  type ReportedValue,
  type ResolvedRule,
} from "@/lib/forms/dishRun";

/**
 * Runs the template's formulas and answers the engine's report. Injected rather
 * than imported so this module stays environment-free: the calculation engine
 * is Pyodide in a sandboxed iframe (`lib/calculations`), which only exists in
 * the browser.
 */
export type DishRunEvaluator = (
  request: CalculationDryRunRequest,
) => Promise<CalculationDryRunResponse>;

/**
 * Decide a dish run: evaluate the per-dish series with the real calculation
 * engine, then let `evaluateDishRun` pick the pair.
 *
 * The engine is the same one that computes the results stored on finish, so the
 * figures this panel shows are the figures the certificate prints.
 */
export async function resolveDishRun(
  template: ExperimentTemplate,
  values: Record<string, AnswerValue>,
  evaluate: DishRunEvaluator,
): Promise<DishRunState> {
  const dishRun = template.labForm.dishRun;
  // No rules at all reads as INACTIVE, which is what a non-dish template is
  if (!dishRun || dishRun.rules.length === 0) {
    return evaluateDishRun({ rules: [], activeDishCount: 0, maxDishes: 2 });
  }

  const limits = dishRun.rules.map((rule) => ({
    target: rule.target,
    label: rule.label,
    limit: rule.limit.value,
    decimals: rule.decimals,
  }));

  const group = readDishGroup(template.labForm);
  const issues: DishRunIssue[] = [];
  if (!group) {
    issues.push({ code: "groupMissing" });
  } else if (dishRun.maxDishes > group.count) {
    issues.push({
      code: "maxDishesAboveCount",
      expected: group.count,
      actual: dishRun.maxDishes,
    });
  }

  // Normalize before evaluating, with the same helper the persist path uses, so
  // the engine sees exactly the columns it will see at submit.
  const normalized = normalizeDishColumns(template.labForm, values);
  const dishes = group ? activeDishCount(group, normalized) : 0;

  if (issues.length > 0 || !group) {
    return evaluateDishRun({
      rules: limits.map((rule) => ({ ...rule, result: undefined })),
      activeDishCount: dishes,
      maxDishes: dishRun.maxDishes,
      issues,
    });
  }

  const response = await evaluate(templateToCalculationDryRun(template, normalized));

  const rules: ResolvedRule[] = limits.map((rule) => {
    const outcome = response.calculations[rule.target];
    if (!outcome) {
      // A comparison may name a measurement rather than a calculation
      const column = response.values[rule.target];
      if (Array.isArray(column)) return { ...rule, result: column };
      return { ...rule, result: undefined };
    }
    if (outcome.status === "ok") return { ...rule, result: outcome.result };
    if (outcome.status === "skipped") {
      return { ...rule, result: Array.from({ length: dishes }, () => null) };
    }
    return {
      ...rule,
      result: undefined,
      error: outcome.error?.message ?? `${rule.target} failed to evaluate`,
    };
  });

  const reported: ReportedValue[] = (dishRun.finals ?? []).map((target) => {
    const calculation = finalCalcName(target);
    const outcome = response.calculations[calculation];
    const value =
      outcome?.status === "ok" && typeof outcome.result === "number"
        ? outcome.result
        : null;
    return {
      target,
      label: dishRun.rules.find((rule) => rule.target === target)?.label ?? target,
      calculation,
      value,
    };
  });

  return evaluateDishRun({
    rules,
    reported,
    activeDishCount: dishes,
    maxDishes: dishRun.maxDishes,
    dishTouched: touchedDishes(group, normalized),
  });
}
