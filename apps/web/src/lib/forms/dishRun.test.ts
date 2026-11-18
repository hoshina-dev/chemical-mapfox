import { describe, expect, it } from "vitest";

import {
  type EvaluateDishRunInput,
  evaluateDishRun,
  type ResolvedRule,
} from "./dishRun";

function rule(
  target: string,
  limit: number,
  result: unknown,
  extra: Partial<ResolvedRule> = {},
): ResolvedRule {
  return { target, label: target, limit, result, ...extra };
}

/** One rule named G, the end of the B,C,D -> E,F,G chain. */
function run(
  series: unknown[],
  { limit = 0.3, maxDishes = 8 }: { limit?: number; maxDishes?: number } = {},
): ReturnType<typeof evaluateDishRun> {
  return evaluateDishRun({
    rules: [rule("G", limit, series)],
    activeDishCount: series.length,
    maxDishes,
  });
}

describe("evaluateDishRun", () => {
  describe("inert cases", () => {
    it("is INACTIVE with no rules", () => {
      const state = evaluateDishRun({ rules: [], activeDishCount: 0, maxDishes: 8 });
      expect(state.phase).toBe("INACTIVE");
      expect(state.acceptedPair).toBeNull();
    });

    it("is CONFIG_ERROR when the caller already found a template problem", () => {
      const state = evaluateDishRun({
        rules: [rule("G", 0.3, [1, 2])],
        activeDishCount: 2,
        maxDishes: 8,
        issues: [{ code: "groupMissing" }],
      });
      expect(state.phase).toBe("CONFIG_ERROR");
      expect(state.issues).toEqual([{ code: "groupMissing" }]);
    });
  });

  describe("progression on one rule", () => {
    it("awaits the first dish when nothing is measured", () => {
      const state = run([]);
      expect(state.phase).toBe("AWAITING_DISHES");
      expect(state.nextDish).toBe(1);
    });

    it("awaits the second dish when only dish 1 is measured", () => {
      const state = run([8.42]);
      expect(state.phase).toBe("AWAITING_DISHES");
      expect(state.nextDish).toBe(2);
    });

    it("is DONE when dishes 1 and 2 agree", () => {
      const state = run([8.42, 8.55]);
      expect(state.phase).toBe("DONE");
      expect(state.acceptedPair).toEqual([1, 2]);
      expect(state.nextDish).toBeNull();
      // The reported value is the engine's `final_*` calculation, passed in by
      // the caller — this module decides the pair, not the number.
      expect(state.reported).toEqual([]);
    });

    it("asks for a third dish when dishes 1 and 2 disagree", () => {
      const state = run([8.42, 8.9]);
      expect(state.phase).toBe("AWAITING_NEXT_DISH");
      expect(state.nextDish).toBe(3);
    });

    // THE PAIR-PRECEDENCE CASE: (1,2) fails, (1,3) and (2,3) are both candidates.
    // Index order must pick (1,3) and leave dish 2 out of the result.
    it("takes the first qualifying pair in index order", () => {
      const state = run([8.42, 8.9, 8.6]);
      expect(state.pairs.map((p) => [p.a, p.b])).toEqual([
        [1, 2],
        [1, 3],
        [2, 3],
      ]);
      expect(state.acceptedPair).toEqual([1, 3]);
      expect(state.staleDishes).toEqual([2]);
    });

    /**
     * Guards the rounding hazard, with the case that exposed it.
     *
     * On paper dishes 2 and 3 differ by exactly 0.30 and a 0.30 limit accepts
     * them. In binary floating point `8.9 - 8.6 === 0.3000000000000007`, which
     * is *over* the limit — so without `decimals` the app disagrees with the
     * technician's arithmetic at the boundary. That matters beyond one pair:
     * a run the lab considers passing can reach NEEDS_REVIEW, and since submit
     * is blocked with no override and `closeTicket` needs completed
     * calculations plus a report, the ticket is then stuck for good.
     *
     * Configuring `decimals` is what makes the comparison agree with the lab.
     */
    it("needs `decimals` to accept a difference the lab reads as exactly at the limit", () => {
      const raw = run([8.42, 8.9, 8.6]);
      const rawPair23 = raw.pairs.find((p) => p.a === 2 && p.b === 3);
      expect(rawPair23?.rules[0]?.diff).toBeGreaterThan(0.3);
      expect(rawPair23?.accepted).toBe(false);

      const rounded = evaluateDishRun({
        rules: [rule("G", 0.3, [8.42, 8.9, 8.6], { decimals: 2 })],
        activeDishCount: 3,
        maxDishes: 8,
      });
      const pair23 = rounded.pairs.find((p) => p.a === 2 && p.b === 3);
      expect(pair23?.rules[0]?.diff).toBe(0.3);
      expect(pair23?.accepted).toBe(true);
      // (1,3) still wins on index order — rounding changes neither the winner
      // nor the final value here, only whether (2,3) was a candidate at all.
      expect(rounded.acceptedPair).toEqual([1, 3]);
    });

    it("accepts a difference exactly equal to the limit", () => {
      // Integers, so the boundary is exact rather than float-lucky.
      const state = run([8, 9], { limit: 1 });
      expect(state.pairs[0]?.rules[0]?.diff).toBe(1);
      expect(state.phase).toBe("DONE");
    });

    it("rejects a difference just over the limit", () => {
      expect(run([8, 9], { limit: 0.999 }).phase).toBe("AWAITING_NEXT_DISH");
    });

    it("accepts identical values against a zero limit", () => {
      expect(run([5, 5], { limit: 0 }).phase).toBe("DONE");
    });

    it("reverts to AWAITING_NEXT_DISH when an accepted dish is re-measured badly", () => {
      expect(run([8.42, 8.55]).phase).toBe("DONE");
      const after = run([8.42, 8.95]);
      expect(after.phase).toBe("AWAITING_NEXT_DISH");
      expect(after.acceptedPair).toBeNull();
    });

    it("needs review once every allowed dish disagrees", () => {
      const state = run([1, 2, 3, 4, 5, 6, 7, 8], { limit: 0.1 });
      expect(state.phase).toBe("NEEDS_REVIEW");
      expect(state.nextDish).toBeNull();
      expect(state.acceptedPair).toBeNull();
    });

    it("asks for the last dish rather than reviewing at maxDishes - 1", () => {
      const state = run([1, 2, 3, 4, 5, 6, 7], { limit: 0.1 });
      expect(state.phase).toBe("AWAITING_NEXT_DISH");
      expect(state.nextDish).toBe(8);
    });
  });

  describe("unmeasured and partial dishes", () => {
    it("skips pairs touching an unmeasured dish and can accept a later pair", () => {
      const state = run([1.0, null, 1.05], { limit: 0.1 });
      expect(state.dishMeasurable).toEqual([true, false, true]);
      expect(state.pairs.find((p) => p.a === 1 && p.b === 2)?.comparable).toBe(false);
      expect(state.acceptedPair).toEqual([1, 3]);
    });

    // A half-filled dish 5 must NOT strand a run that already finished at (1,2).
    it("stays DONE when an extra dish holds data, reporting it as stale only", () => {
      const state = evaluateDishRun({
        rules: [rule("G", 0.3, [8.42, 8.55, null])],
        activeDishCount: 3,
        maxDishes: 8,
        dishTouched: [true, true, true],
      });
      expect(state.phase).toBe("DONE");
      expect(state.acceptedPair).toEqual([1, 2]);
      expect(state.staleDishes).toEqual([3]);
    });

    // Incompleteness is never grounds for NEEDS_REVIEW — the run just is not
    // finished being measured.
    it("awaits dishes rather than reviewing when the last dish is incomplete", () => {
      const state = run([1, 2, 3, 4, 5, 6, 7, null], { limit: 0.1 });
      expect(state.phase).toBe("AWAITING_DISHES");
      expect(state.nextDish).toBe(8);
    });

    it.each([
      ["null", null],
      ["undefined", undefined],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["a non-numeric string", "abc"],
      ["an empty string", ""],
      ["a boolean", true],
    ])("treats %s in the series as unmeasured", (_label, cell) => {
      const state = run([8.42, cell]);
      expect(state.dishMeasurable).toEqual([true, false]);
      expect(state.phase).toBe("AWAITING_DISHES");
    });

    it("coerces numeric strings, which the schema permits for any answer", () => {
      const state = run(["8.42", "8.55"]);
      expect(state.phase).toBe("DONE");
      expect(state.acceptedPair).toEqual([1, 2]);
    });
  });

  describe("config errors never become a misread", () => {
    it.each([
      ["the target produced a scalar", 12.5, "targetNotList"],
      ["the target is missing entirely", undefined, "targetMissing"],
    ])("reports %s", (_label, result, code) => {
      const state = evaluateDishRun({
        rules: [rule("G", 0.3, result)],
        activeDishCount: 2,
        maxDishes: 8,
      });
      expect(state.phase).toBe("CONFIG_ERROR");
      expect(state.issues[0]?.code).toBe(code);
    });

    it("carries the engine's message when the target itself failed", () => {
      const state = evaluateDishRun({
        rules: [rule("G", 0.3, undefined, { error: "unsupported operand type(s)" })],
        activeDishCount: 2,
        maxDishes: 8,
      });
      expect(state.phase).toBe("CONFIG_ERROR");
      expect(state.issues[0]).toMatchObject({
        code: "targetError",
        detail: "unsupported operand type(s)",
      });
    });

    // THE `E + F` TEST. Two per-dish lists added with `+` concatenate in Python,
    // so a 2-dish run yields a 4-entry result. Nothing else would notice.
    it("rejects a doubled-length result, which is how list concatenation shows up", () => {
      const state = evaluateDishRun({
        rules: [rule("G", 0.3, [1, 2, 3, 4])],
        activeDishCount: 2,
        maxDishes: 8,
      });
      expect(state.phase).toBe("CONFIG_ERROR");
      expect(state.issues[0]).toEqual({
        code: "targetLengthMismatch",
        target: "G",
        expected: 2,
        actual: 4,
      });
    });

    // THE ZIP-TRUNCATION TEST: mismatched columns make `zip` drop a dish.
    it("rejects a result shorter than the measured dishes", () => {
      const state = evaluateDishRun({
        rules: [rule("G", 0.3, [1, 2])],
        activeDishCount: 3,
        maxDishes: 8,
      });
      expect(state.phase).toBe("CONFIG_ERROR");
      expect(state.issues[0]).toMatchObject({ expected: 3, actual: 2 });
    });

    it("reports nothing on a config error", () => {
      const state = evaluateDishRun({
        rules: [rule("G", 0.3, 1)],
        activeDishCount: 2,
        maxDishes: 8,
      });
      expect(state.acceptedPair).toBeNull();
      expect(state.reported).toEqual([]);
    });
  });

  describe("several rules share one accepted pair", () => {
    const moisture = (series: unknown) => rule("moisture", 0.3, series);
    const ash = (series: unknown) => rule("ash", 0.2, series);

    it("rejects a pair that fails any single rule", () => {
      const state = evaluateDishRun({
        rules: [moisture([8.42, 8.55]), ash([14.1, 14.54])],
        activeDishCount: 2,
        maxDishes: 8,
      });
      expect(state.phase).toBe("AWAITING_NEXT_DISH");
      expect(state.pairs[0]?.rules.map((r) => r.within)).toEqual([true, false]);
    });

    it("accepts the first pair where every rule passes", () => {
      const state = evaluateDishRun({
        rules: [moisture([8.42, 8.55, 8.6]), ash([14.1, 14.54, 14.2])],
        activeDishCount: 3,
        maxDishes: 8,
      });
      expect(state.acceptedPair).toEqual([1, 3]);
      expect(state.staleDishes).toEqual([2]);
    });

    it("requires every rule's series to be present", () => {
      const state = evaluateDishRun({
        rules: [moisture([8.42, 8.55]), ash([14.1, null])],
        activeDishCount: 2,
        maxDishes: 8,
      });
      expect(state.dishMeasurable).toEqual([true, false]);
      expect(state.phase).toBe("AWAITING_DISHES");
    });
  });

  describe("rounding", () => {
    // Labs state the tolerance against the ROUNDED result. Rounding the
    // difference too is what keeps an exactly-at-limit case from failing on
    // float noise (1.35 - 1.24 === 0.11000000000000004).
    it("compares rounded values and a rounded difference", () => {
      const state = evaluateDishRun({
        rules: [rule("G", 0.11, [1.2449, 1.3451], { decimals: 2 })],
        activeDishCount: 2,
        maxDishes: 8,
      });
      expect(state.pairs[0]?.rules[0]?.valueA).toBe(1.24);
      expect(state.pairs[0]?.rules[0]?.valueB).toBe(1.35);
      expect(state.pairs[0]?.rules[0]?.diff).toBe(0.11);
      expect(state.phase).toBe("DONE");
    });

    it("compares raw values when no decimals are configured", () => {
      const state = evaluateDishRun({
        rules: [rule("G", 0.1, [1.2449, 1.3451])],
        activeDishCount: 2,
        maxDishes: 8,
      });
      expect(state.phase).toBe("AWAITING_NEXT_DISH");
    });

    it("carries the engine's reported values through untouched", () => {
      const state = evaluateDishRun({
        rules: [rule("G", 0.3, [8.42, 8.55])],
        reported: [
          { target: "G", label: "G", calculation: "final_G", value: 8.49 },
        ],
        activeDishCount: 2,
        maxDishes: 8,
      });
      expect(state.reported).toEqual([
        { target: "G", label: "G", calculation: "final_G", value: 8.49 },
      ]);
    });
  });

  describe("hygiene", () => {
    it("never mutates its input", () => {
      const input: EvaluateDishRunInput = {
        rules: [rule("G", 0.3, [8.42, 8.55])],
        activeDishCount: 2,
        maxDishes: 8,
      };
      const snapshot = JSON.stringify(input);
      evaluateDishRun(input);
      expect(JSON.stringify(input)).toBe(snapshot);
    });

    it("is deterministic, so deriving at render time is safe", () => {
      const build = (): EvaluateDishRunInput => ({
        rules: [rule("G", 0.3, [8.42, 8.9, 8.6])],
        activeDishCount: 3,
        maxDishes: 8,
      });
      expect(evaluateDishRun(build())).toEqual(evaluateDishRun(build()));
    });

    it("clamps the active dish count to maxDishes", () => {
      const state = evaluateDishRun({
        rules: [rule("G", 0.3, [1, 2])],
        activeDishCount: 99,
        maxDishes: 2,
      });
      expect(state.activeDishCount).toBe(2);
    });
  });
});
