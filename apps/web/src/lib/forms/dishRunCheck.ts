import type { ExperimentTemplate } from "@repo/forms";

import type { CalculationDryRunResponse } from "@/lib/calculations/types";
import { readDishGroup } from "@/lib/forms/dishColumns";

/**
 * The authoring-time shape gate for a dish-run template, run against a report
 * from the calculation engine. Not server-only: the engine is Pyodide in the
 * browser, so this runs wherever that report was produced.
 */

/** Whether this template declares a dish run at all. */
export function isDishRunTemplate(template: ExperimentTemplate): boolean {
  return template.labForm.dishRun !== undefined;
}

/**
 * How many dishes the dry run's values actually describe, read back from the
 * response rather than assumed, so the expectation always matches what the
 * engine saw.
 */
function dishCountInDryRun(
  template: ExperimentTemplate,
  result: CalculationDryRunResponse,
): number | null {
  const group = readDishGroup(template.labForm);
  if (!group) return null;
  for (const childId of group.childIds) {
    const column = result.values[childId];
    if (Array.isArray(column)) return column.length;
  }
  return null;
}

/**
 * Everything wrong with a dish-run template's tolerance rules, as lines ready
 * to show the author. Empty when the template is fine or is not a dish run.
 */
export function dishRunShapeErrors(
  template: ExperimentTemplate,
  result: CalculationDryRunResponse,
): string[] {
  const dishRun = template.labForm.dishRun;
  if (!dishRun) return [];

  const lines: string[] = [];
  const group = readDishGroup(template.labForm);
  if (!group) {
    lines.push(
      `The dish run names '${dishRun.group}', which is not a repeatable-group question in the lab form.`,
    );
    return lines;
  }
  if (dishRun.maxDishes > group.count) {
    lines.push(
      `The dish run allows ${dishRun.maxDishes} dishes but '${group.groupId}' repeats only ${group.count} times. A form cannot grow once an experiment exists, so the group's count must be at least maxDishes.`,
    );
  }

  const expected = dishCountInDryRun(template, result);
  const measurements = new Set(group.childIds);
  for (const rule of dishRun.rules) {
    // A comparison may name a measurement instead of a calculation.
    if (measurements.has(rule.target)) continue;

    const outcome = result.calculations[rule.target];
    if (!outcome) {
      lines.push(
        `Tolerance rule target '${rule.target}' is neither a measurement on each dish nor a calculation in this template.`,
      );
      continue;
    }
    // An outcome that did not evaluate is formulaCheckFailed's to report.
    if (outcome.status !== "ok") continue;

    if (!Array.isArray(outcome.result)) {
      lines.push(
        `Tolerance rule target '${rule.target}' must produce one value per dish, but it produced a single value. Write it as a comprehension over the dish columns, e.g. [a + b for a, b in zip(values['a'], values['b'])].`,
      );
      continue;
    }
    if (expected !== null && outcome.result.length !== expected) {
      lines.push(
        `Tolerance rule target '${rule.target}' produced ${outcome.result.length} values for ${expected} dishes. A per-dish formula must combine its inputs element by element — note that '+' between two per-dish lists concatenates them in Python instead of adding, which doubles the length.`,
      );
    }
  }
  return lines;
}

/** `dishRunShapeErrors` as one message, or `null` when there is nothing wrong. */
export function dishRunCheckFailed(
  template: ExperimentTemplate,
  result: CalculationDryRunResponse,
): string | null {
  const lines = dishRunShapeErrors(template, result);
  return lines.length > 0 ? lines.join("\n") : null;
}
