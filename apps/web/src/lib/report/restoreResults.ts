import type { FormDraft } from "@/lib/builder";
import { finalCalcName } from "@/lib/forms/dishFormula";

/**
 * Puts the given printed results back into `draft` from `saved` (the method as last
 * saved), leaving every other edit as it is. A plain result is its calculation; a dish
 * run's final_<target> is its target in the finals list (and the per-dish calculation
 * behind it, when that was removed too). Returns the results it brought back; one it
 * cannot (e.g. the dish run was turned off) stays out.
 */
export function restoreResults(
  draft: FormDraft,
  saved: FormDraft,
  results: string[],
): { draft: FormDraft; restored: string[] } {
  let calculations = [...draft.calculations];
  let dishRun = draft.labForm.dishRun;
  const savedRun = saved.labForm.dishRun;
  const restored: string[] = [];

  for (const result of results) {
    const calc = saved.calculations.find((c) => c.name.trim() === result);
    if (calc && !calculations.some((c) => c.name.trim() === result)) {
      const at = Math.min(saved.calculations.indexOf(calc), calculations.length);
      calculations = [...calculations.slice(0, at), calc, ...calculations.slice(at)];
      restored.push(result);
      continue;
    }
    const target = savedRun?.finals?.find((f) => finalCalcName(f) === result);
    if (target === undefined || !dishRun) continue;
    const perDish = savedRun?.calculations?.find((c) => c.name.trim() === target);
    const current = dishRun.calculations ?? [];
    dishRun = {
      ...dishRun,
      finals: (dishRun.finals ?? []).includes(target)
        ? dishRun.finals
        : [...(dishRun.finals ?? []), target],
      calculations:
        perDish && !current.some((c) => c.name.trim() === target)
          ? [...current, perDish]
          : dishRun.calculations,
    };
    restored.push(result);
  }
  return {
    draft: { ...draft, calculations, labForm: { ...draft.labForm, dishRun } },
    restored,
  };
}
