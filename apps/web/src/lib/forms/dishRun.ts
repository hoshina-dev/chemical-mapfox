/**
 * The dish-run decision: which pair of dishes agrees, and what the final value is
 */

export type DishRunPhase =
  /** Not a dish-run template — the feature is inert. */
  | "INACTIVE"
  /** A template bug: the run cannot be evaluated at all. */
  | "CONFIG_ERROR"
  /** Fewer than two dishes have a complete set of results yet. */
  | "AWAITING_DISHES"
  /** No pair agrees and another dish is still allowed. */
  | "AWAITING_NEXT_DISH"
  /** A pair agrees; the final value is available. */
  | "DONE"
  /** Every allowed dish is measured and no pair agrees. */
  | "NEEDS_REVIEW";

export type DishRunIssueCode =
  /** `dishRun.group` names no repeatable-group question. */
  | "groupMissing"
  /** `maxDishes` exceeds the group's `count`, which cannot grow mid-experiment. */
  | "maxDishesAboveCount"
  /** A rule's `target` names no calculation in the template. */
  | "targetMissing"
  /** The target calculation itself failed to evaluate. */
  | "targetError"
  /** The target produced a scalar where a per-dish list was required. */
  | "targetNotList"
  /** The target produced a list of the wrong length */
  | "targetLengthMismatch";

export interface DishRunIssue {
  code: DishRunIssueCode;
  /** The rule target the issue concerns, when it is rule-scoped. */
  target?: string;
  expected?: number;
  actual?: number;
  /** Verbatim engine message for `targetError`. Not translated. */
  detail?: string;
}

/** One tolerance rule with its series already evaluated by the backend. */
export interface ResolvedRule {
  /** Calculation name compared between dishes (the end of the chain). */
  target: string;
  label: string;
  /** Already resolved to a number. v1 limits are absolute. */
  limit: number;
  /**
   * Round to this many decimals before comparing, and for the final mean. Labs
   * state tolerances against the *rounded* result. Omitted = compare raw.
   */
  decimals?: number;
  /** The calculation's result, verbatim from the engine. Validated here. */
  result: unknown;
  /** Set when the calculation did not evaluate. */
  error?: string;
}

export interface RuleComparison {
  target: string;
  label: string;
  limit: number;
  /** Rounded values actually compared, so the UI can show what the lab sees. */
  valueA: number | null;
  valueB: number | null;
  /** `null` when either dish is unmeasured. */
  diff: number | null;
  within: boolean;
}

export interface PairComparison {
  /** 1-based dish numbers. */
  a: number;
  b: number;
  /** Both dishes have every rule target present and finite. */
  comparable: boolean;
  rules: RuleComparison[];
  /** `comparable` and every rule within tolerance. */
  accepted: boolean;
}

export interface DishRunState {
  phase: DishRunPhase;
  /** Dishes touched so far (0 when untouched), never above `maxDishes`. */
  activeDishCount: number;
  /** The dish to measure now, or `null` when there is nothing to do. */
  nextDish: number | null;
  /** Per dish (index 0 = dish 1): every rule target present and finite. */
  dishMeasurable: boolean[];
  /** Candidate pairs in evaluation order. */
  pairs: PairComparison[];
  acceptedPair: [number, number] | null;
  reported: ReportedValue[];
  /** Dishes holding data but outside the accepted pair.*/
  staleDishes: number[];
  issues: DishRunIssue[];
}

/** One reported value, as produced by its generated `final_*` calculation. */
export interface ReportedValue {
  /** The quantity averaged, e.g. `"G"`. */
  target: string;
  label: string;
  /** The calculation that produced it, e.g. `"final_G"` — also the PDF variable. */
  calculation: string;
  /** `null` until the run finishes, or if the engine could not compute it. */
  value: number | null;
}

export interface EvaluateDishRunInput {
  rules: ResolvedRule[];
  /** Reported values read from the engine, passed straight through. */
  reported?: ReportedValue[];
  /** From `activeDishCount` in `dishColumns.ts`. */
  activeDishCount: number;
  maxDishes: number;
  dishTouched?: boolean[];
  /** Template-level problems the caller already found (group, maxDishes). */
  issues?: DishRunIssue[];
}

function roundTo(value: number, decimals?: number): number {
  if (decimals === undefined) return value;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// A cell as a finite number, or `null`.
function toFinite(cell: unknown): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  if (typeof cell === "string" && cell.trim() !== "") {
    const parsed = Number(cell);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

interface PreparedRule extends ResolvedRule {
  /** One entry per dish, `null` where unmeasured. Length = activeDishCount. */
  series: (number | null)[];
}

// Validates each rule's series shape.
function prepareRules(
  rules: readonly ResolvedRule[],
  activeDishCount: number,
): { prepared: PreparedRule[]; issues: DishRunIssue[] } {
  const issues: DishRunIssue[] = [];
  const prepared: PreparedRule[] = [];

  for (const rule of rules) {
    if (rule.error !== undefined) {
      issues.push({ code: "targetError", target: rule.target, detail: rule.error });
      continue;
    }
    if (rule.result === undefined) {
      issues.push({ code: "targetMissing", target: rule.target });
      continue;
    }
    if (!Array.isArray(rule.result)) {
      issues.push({ code: "targetNotList", target: rule.target });
      continue;
    }
    if (rule.result.length !== activeDishCount) {
      issues.push({
        code: "targetLengthMismatch",
        target: rule.target,
        expected: activeDishCount,
        actual: rule.result.length,
      });
      continue;
    }
    prepared.push({ ...rule, series: rule.result.map(toFinite) });
  }
  return { prepared, issues };
}

function inertState(
  phase: DishRunPhase,
  reported: ReportedValue[],
  issues: DishRunIssue[],
  activeDishCount = 0,
): DishRunState {
  return {
    phase,
    activeDishCount,
    nextDish: null,
    dishMeasurable: [],
    pairs: [],
    acceptedPair: null,
    reported,
    staleDishes: [],
    issues,
  };
}

/**
 * Candidate pairs in the order the lab works through them: dish 2 against dish
 * 1, then dish 3 against 1 and 2, and so on — (1,2), (1,3), (2,3), (1,4), …
 * The *first* pair where every rule passes is the accepted one.
 */
function pairOrder(dishCount: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let b = 2; b <= dishCount; b += 1) {
    for (let a = 1; a < b; a += 1) pairs.push([a, b]);
  }
  return pairs;
}

export function evaluateDishRun(input: EvaluateDishRunInput): DishRunState {
  const { rules, maxDishes } = input;
  const reported = input.reported ?? [];
  const inputIssues = input.issues ?? [];
  const activeDishCount = Math.max(0, Math.min(input.activeDishCount, maxDishes));

  if (rules.length === 0) return inertState("INACTIVE", reported, inputIssues);
  if (inputIssues.length > 0) {
    return inertState("CONFIG_ERROR", reported, inputIssues, activeDishCount);
  }

  const { prepared, issues } = prepareRules(rules, activeDishCount);
  if (issues.length > 0) {
    return inertState("CONFIG_ERROR", reported, issues, activeDishCount);
  }

  const dishMeasurable = Array.from({ length: activeDishCount }, (_, index) =>
    prepared.every((rule) => rule.series[index] !== null),
  );
  const dishTouched =
    input.dishTouched ??
    Array.from({ length: activeDishCount }, (_, index) => dishMeasurable[index] === true);

  const pairs: PairComparison[] = pairOrder(activeDishCount).map(([a, b]) => {
    const comparable = dishMeasurable[a - 1] === true && dishMeasurable[b - 1] === true;
    const ruleResults: RuleComparison[] = prepared.map((rule) => {
      const rawA = rule.series[a - 1];
      const rawB = rule.series[b - 1];
      if (rawA === null || rawA === undefined || rawB === null || rawB === undefined) {
        return {
          target: rule.target,
          label: rule.label,
          limit: rule.limit,
          valueA: null,
          valueB: null,
          diff: null,
          within: false,
        };
      }
      const valueA = roundTo(rawA, rule.decimals);
      const valueB = roundTo(rawB, rule.decimals);
      const diff = roundTo(Math.abs(valueA - valueB), rule.decimals);
      return {
        target: rule.target,
        label: rule.label,
        limit: rule.limit,
        valueA,
        valueB,
        // Inclusive: a difference exactly equal to the limit passes.
        diff,
        within: diff <= rule.limit,
      };
    });
    return {
      a,
      b,
      comparable,
      rules: ruleResults,
      // ALL rules must pass, so there is exactly one accepted pair per
      // experiment rather than one per quantity.
      accepted: comparable && ruleResults.every((rule) => rule.within),
    };
  });

  const measurableCount = dishMeasurable.filter(Boolean).length;
  const accepted = pairs.find((pair) => pair.accepted) ?? null;

  const firstUnmeasured = dishMeasurable.indexOf(false);
  const nextIncomplete = firstUnmeasured === -1 ? activeDishCount : firstUnmeasured;
  const nextDish = nextIncomplete < maxDishes ? nextIncomplete + 1 : null;

  const base = {
    activeDishCount,
    dishMeasurable,
    pairs,
    issues: [] as DishRunIssue[],
  };

  if (accepted) {
    const staleDishes: number[] = [];
    for (let dish = 1; dish <= activeDishCount; dish += 1) {
      if (dish === accepted.a || dish === accepted.b) continue;
      if (dishTouched[dish - 1]) staleDishes.push(dish);
    }
    return {
      ...base,
      phase: "DONE",
      nextDish: null,
      acceptedPair: [accepted.a, accepted.b],
      reported,
      staleDishes,
    };
  }

  const unresolved = {
    ...base,
    nextDish,
    acceptedPair: null,
    reported,
    staleDishes: [],
  };

  // A dish whose results are incomplete is never grounds for NEEDS_REVIEW — the
  // run simply is not finished being measured yet.
  if (measurableCount < 2) return { ...unresolved, phase: "AWAITING_DISHES" };
  if (activeDishCount < maxDishes) return { ...unresolved, phase: "AWAITING_NEXT_DISH" };
  if (measurableCount < maxDishes) return { ...unresolved, phase: "AWAITING_DISHES" };
  return { ...unresolved, phase: "NEEDS_REVIEW", nextDish: null };
}
