import type { ExperimentTemplate, Question } from "@repo/forms";
import { describe, expect, it } from "vitest";

import type { CalculationDryRunResponse } from "@/lib/calculations/types";

import { dishRunCheckFailed, dishRunShapeErrors, isDishRunTemplate } from "./dishRunCheck";

const dishes: Question = {
  id: "dishes",
  type: "repeatable-group",
  label: "Dish",
  config: {
    count: 8,
    itemLabel: "Dish",
    questions: [
      { id: "B", type: "number", label: "B" },
      { id: "C", type: "number", label: "C" },
    ],
  },
};

function template({
  dishRun = true,
  group = "dishes",
  maxDishes = 8,
  target = "G",
}: {
  dishRun?: boolean;
  group?: string;
  maxDishes?: number;
  target?: string;
} = {}): ExperimentTemplate {
  return {
    clientForm: { name: "Client", questions: [] },
    labForm: {
      name: "Lab",
      questions: [dishes],
      ...(dishRun
        ? {
            dishRun: {
              group,
              maxDishes,
              rules: [
                { target, label: "G", limit: { kind: "absolute" as const, value: 0.3 } },
              ],
            },
          }
        : {}),
    },
    calculations: { G: { formula: "…" } },
  };
}

/** A dry run over three stand-in dishes (two measured, one being measured). */
function dryRun(
  calculations: CalculationDryRunResponse["calculations"],
  dishColumnLength = 3,
): CalculationDryRunResponse {
  const column = Array.from({ length: dishColumnLength }, (_, i) =>
    i === dishColumnLength - 1 ? null : 1,
  );
  return {
    values: { B: column, C: column },
    order: Object.keys(calculations),
    calculations,
    missing_values: [],
    duplicate_question_ids: [],
  };
}

const ok = (result: unknown) => ({ formula: "…", status: "ok" as const, result });

describe("isDishRunTemplate", () => {
  it("is true only when the lab form declares a dish run", () => {
    expect(isDishRunTemplate(template())).toBe(true);
    expect(isDishRunTemplate(template({ dishRun: false }))).toBe(false);
  });
});

describe("dishRunShapeErrors", () => {
  it("accepts a target with one value per dish", () => {
    expect(dishRunShapeErrors(template(), dryRun({ G: ok([3, 3, null]) }))).toEqual([]);
  });

  it("is inert for a template with no dish run", () => {
    expect(
      dishRunShapeErrors(template({ dishRun: false }), dryRun({ G: ok(12.5) })),
    ).toEqual([]);
  });

  // THE `E + F` CASE: two per-dish lists added with `+` concatenate, so the
  // result is twice as long and every formula still reports "ok".
  it("rejects a doubled-length target and names the concatenation trap", () => {
    const [message, ...rest] = dishRunShapeErrors(
      template(),
      dryRun({ G: ok([3, 3, null, 1, 1, null]) }),
    );
    expect(rest).toEqual([]);
    expect(message).toContain("produced 6 values for 3 dishes");
    expect(message).toContain("concatenates");
  });

  // THE ZIP-TRUNCATION CASE.
  it("rejects a target shorter than the dish count", () => {
    expect(dishRunShapeErrors(template(), dryRun({ G: ok([3, 3]) }))[0]).toContain(
      "produced 2 values for 3 dishes",
    );
  });

  it("rejects a scalar target and suggests a comprehension", () => {
    const message = dishRunShapeErrors(template(), dryRun({ G: ok(12.5) }))[0];
    expect(message).toContain("produced a single value");
    expect(message).toContain("zip");
  });

  it("rejects a target that is neither a measurement nor a calculation", () => {
    expect(
      dishRunShapeErrors(template({ target: "H" }), dryRun({ G: ok([3, 3, null]) }))[0],
    ).toContain("'H' is neither a measurement on each dish nor a calculation");
  });

  // A measurement's column is one value per dish by construction, so there is
  // no shape to check — only that the name refers to something real.
  it("accepts a comparison on a measurement without checking its shape", () => {
    expect(
      dishRunShapeErrors(template({ target: "B" }), dryRun({ G: ok([3, 3, null]) })),
    ).toEqual([]);
  });

  it("rejects a dish run naming a question that is not a repeatable group", () => {
    expect(dishRunShapeErrors(template({ group: "absent" }), dryRun({}))).toEqual([
      "The dish run names 'absent', which is not a repeatable-group question in the lab form.",
    ]);
  });

  it("rejects maxDishes above the group's repetition count", () => {
    expect(
      dishRunShapeErrors(template({ maxDishes: 12 }), dryRun({ G: ok([3, 3, null]) }))[0],
    ).toContain("allows 12 dishes but 'dishes' repeats only 8 times");
  });

  // A formula that failed to evaluate is formulaCheckFailed's business; saying
  // it twice would bury the shape signal.
  it.each([["error"], ["skipped"]] as const)(
    "stays quiet about a target whose status is %s",
    (status) => {
      expect(
        dishRunShapeErrors(template(), dryRun({ G: { formula: "…", status } })),
      ).toEqual([]);
    },
  );

  it("tolerates a dry run whose dish columns are missing", () => {
    const response = { ...dryRun({ G: ok(12.5) }), values: {} };
    // The scalar is still caught; only the length comparison is skipped.
    expect(dishRunShapeErrors(template(), response)[0]).toContain("single value");
  });

  it("skips the length check when no dish column is an array", () => {
    const response = { ...dryRun({ G: ok([1, 2, 3, 4, 5]) }), values: { B: "nope" } };
    expect(dishRunShapeErrors(template(), response)).toEqual([]);
  });
});

describe("dishRunCheckFailed", () => {
  it("is null when nothing is wrong", () => {
    expect(dishRunCheckFailed(template(), dryRun({ G: ok([3, 3, null]) }))).toBeNull();
  });

  it("joins every problem into one message", () => {
    const message = dishRunCheckFailed(
      template({ maxDishes: 12, target: "H" }),
      dryRun({ G: ok([3, 3, null]) }),
    );
    expect(message).toContain("allows 12 dishes");
    expect(message).toContain("'H' is neither a measurement");
    expect(message?.split("\n")).toHaveLength(2);
  });
});
