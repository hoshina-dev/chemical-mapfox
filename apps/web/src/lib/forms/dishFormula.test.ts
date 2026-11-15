import { describe, expect, it } from "vitest";

import { generateDishFormula, type SeriesLookup } from "./dishFormula";

/** B, C, D are dish measurements; E and F are earlier per-dish calculations. */
const series: SeriesLookup = (name) => {
  if (["B", "C", "D"].includes(name)) return `values['${name}']`;
  if (["E", "F"].includes(name)) return name;
  return undefined;
};

function formula(expression: string): string {
  const result = generateDishFormula(expression, series);
  if (!result.ok) throw new Error(`unexpected rejection: ${result.code}`);
  return result.formula;
}

describe("generateDishFormula", () => {
  it("combines two measurements elementwise, guarding both", () => {
    expect(formula("B + C")).toBe(
      "[v0 + v1 if v0 is not None and v1 is not None else None " +
        "for v0, v1 in zip(values['B'], values['C'])]",
    );
  });

  // THE CASE THIS EXISTS FOR: written by hand, `E + F` concatenates the two
  // lists instead of adding them, silently.
  it("adds two calculations elementwise rather than concatenating them", () => {
    expect(formula("E + F")).toBe(
      "[v0 + v1 if v0 is not None and v1 is not None else None " +
        "for v0, v1 in zip(E, F)]",
    );
  });

  it("iterates a single series directly, since zip of one yields tuples", () => {
    expect(formula("B * 2")).toBe(
      "[v0 * 2 if v0 is not None else None for v0 in values['B']]",
    );
  });

  it("reuses one loop variable for a name referenced twice", () => {
    expect(formula("B + B")).toBe(
      "[v0 + v0 if v0 is not None else None for v0 in values['B']]",
    );
  });

  // Division by zero aborts the entire calculate run, exactly as None does.
  it("guards a divisor that is a bare name", () => {
    expect(formula("B / C")).toBe(
      "[v0 / v1 if v0 is not None and v1 is not None and v1 != 0 else None " +
        "for v0, v1 in zip(values['B'], values['C'])]",
    );
  });

  it("guards the divisor only, not every name", () => {
    // Loop variables are numbered in first-seen order, so in both cases the
    // divisor is v1 and the dividend v0 — only the divisor can be zero.
    expect(formula("B * 100 / C")).toContain("v1 != 0");
    expect(formula("B * 100 / C")).not.toContain("v0 != 0");
    expect(formula("C / B")).toContain("v1 != 0");
    expect(formula("C / B")).not.toContain("v0 != 0");
  });

  it("keeps parentheses and mixed precedence intact", () => {
    expect(formula("(B - C) * 100 / D")).toBe(
      "[( v0 - v1 ) * 100 / v2 if v0 is not None and v1 is not None " +
        "and v2 is not None and v2 != 0 else None " +
        "for v0, v1, v2 in zip(values['B'], values['C'], values['D'])]",
    );
  });

  it("mixes measurements and calculations in one expression", () => {
    expect(formula("E + B")).toBe(
      "[v0 + v1 if v0 is not None and v1 is not None else None " +
        "for v0, v1 in zip(E, values['B'])]",
    );
  });

  it("accepts decimals", () => {
    expect(formula("B * 0.5")).toContain("v0 * 0.5");
  });

  describe("rejections", () => {
    it.each([
      ["an empty expression", "", "empty"],
      ["whitespace only", "   ", "empty"],
      ["a dunder", "B.__class__", "dunder"],
      ["a character outside the grammar", "B % C", "badCharacter"],
      ["a quote", "values['B']", "badCharacter"],
      ["a constant with no series", "2 + 2", "noReferences"],
    ] as const)("rejects %s", (_label, expression, code) => {
      const result = generateDishFormula(expression, series);
      expect(result).toMatchObject({ ok: false, code });
    });

    it("names the unknown reference so the author can fix the typo", () => {
      expect(generateDishFormula("B + Q", series)).toEqual({
        ok: false,
        code: "unknownName",
        name: "Q",
      });
    });

    it("rejects a name that is a formula builtin rather than a series", () => {
      // `mean` is a real engine builtin, but it is not a per-dish series — using
      // it here would produce a scalar and fail the shape gate later.
      expect(generateDishFormula("mean + B", series)).toMatchObject({
        ok: false,
        code: "unknownName",
        name: "mean",
      });
    });
  });
});
