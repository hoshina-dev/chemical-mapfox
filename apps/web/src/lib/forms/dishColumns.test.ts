import type { AnswerValue } from "@repo/forms";
import { describe, expect, it } from "vitest";

import {
  activeDishCount,
  type DishGroupShape,
  normalizeDishColumns,
  readDishGroup,
} from "./dishColumns";

/**
 * Built as a raw wire snapshot (plain JSON, not Zod-parsed), because that is
 * what `templateToExperimentUpdate` passes in.
 */
function labForm({
  dishRun = true,
  count = 8,
  extraGroup = false,
}: { dishRun?: boolean; count?: number; extraGroup?: boolean } = {}) {
  return {
    name: "Lab form",
    questions: [
      { id: "operator", type: "string", label: "Operator" },
      {
        id: "dishes",
        type: "repeatable-group",
        label: "Dish",
        config: {
          count,
          itemLabel: "Dish",
          questions: [
            { id: "B", type: "number", label: "B" },
            { id: "C", type: "number", label: "C" },
            { id: "D", type: "number", label: "D" },
          ],
        },
      },
      ...(extraGroup
        ? [
            {
              id: "sieves",
              type: "repeatable-group",
              label: "Sieve",
              config: {
                count: 4,
                questions: [{ id: "retained", type: "number", label: "Retained" }],
              },
            },
          ]
        : []),
    ],
    ...(dishRun
      ? {
          dishRun: {
            group: "dishes",
            maxDishes: count,
            rules: [
              { target: "G", label: "G", limit: { kind: "absolute", value: 0.3 } },
            ],
          },
        }
      : {}),
  };
}

const group: DishGroupShape = { groupId: "dishes", childIds: ["B", "C", "D"], count: 8 };

describe("readDishGroup", () => {
  it("finds the group named by dishRun", () => {
    expect(readDishGroup(labForm())).toEqual({
      groupId: "dishes",
      childIds: ["B", "C", "D"],
      count: 8,
    });
  });

  it.each([
    ["no dishRun", labForm({ dishRun: false })],
    ["not a form", null],
    ["not an object", "lab form"],
    ["questions missing", { name: "Lab", dishRun: { group: "dishes" } }],
    [
      "dishRun names a question that is not a repeatable group",
      { name: "Lab", questions: [{ id: "x", type: "number" }], dishRun: { group: "x" } },
    ],
    [
      "dishRun names nothing present",
      { ...labForm(), dishRun: { group: "absent", maxDishes: 8, rules: [] } },
    ],
    [
      "group has no children",
      {
        name: "Lab",
        questions: [
          { id: "d", type: "repeatable-group", config: { count: 2, questions: [] } },
        ],
        dishRun: { group: "d" },
      },
    ],
    [
      "group count is not a positive integer",
      {
        name: "Lab",
        questions: [
          {
            id: "d",
            type: "repeatable-group",
            config: { count: 0, questions: [{ id: "B" }] },
          },
        ],
        dishRun: { group: "d" },
      },
    ],
    // The wire snapshot is untyped, so every one of these can arrive in
    // principle and must degrade to "not a dish run" rather than throw on a
    // persist path.
    ["the form is an array", []],
    [
      "the group has no config at all",
      { name: "Lab", questions: [{ id: "d", type: "repeatable-group" }], dishRun: { group: "d" } },
    ],
    [
      "the group's child list is not an array",
      {
        name: "Lab",
        questions: [
          { id: "d", type: "repeatable-group", config: { count: 2, questions: "nope" } },
        ],
        dishRun: { group: "d" },
      },
    ],
    [
      "the count is not a number",
      {
        name: "Lab",
        questions: [
          {
            id: "d",
            type: "repeatable-group",
            config: { count: "8", questions: [{ id: "B" }] },
          },
        ],
        dishRun: { group: "d" },
      },
    ],
    [
      "the count is fractional",
      {
        name: "Lab",
        questions: [
          {
            id: "d",
            type: "repeatable-group",
            config: { count: 2.5, questions: [{ id: "B" }] },
          },
        ],
        dishRun: { group: "d" },
      },
    ],
    [
      "a question entry is an array rather than an object",
      { name: "Lab", questions: [[]], dishRun: { group: "d" } },
    ],
  ])("returns null when %s", (_label, form) => {
    expect(readDishGroup(form)).toBeNull();
  });

  it("ignores child entries that are not objects", () => {
    expect(
      readDishGroup({
        name: "Lab",
        questions: [
          {
            id: "d",
            type: "repeatable-group",
            config: { count: 2, questions: ["nope", { id: "B" }, null] },
          },
        ],
        dishRun: { group: "d" },
      }),
    ).toEqual({ groupId: "d", childIds: ["B"], count: 2 });
  });
});

describe("activeDishCount", () => {
  it.each([
    ["no columns at all", {}, 0],
    ["columns present but empty", { B: [], C: [], D: [] }, 0],
    ["columns of only nulls", { B: [null, null], C: [null, null] }, 0],
    ["two dishes measured", { B: [1, 2], C: [3, 4], D: [5, 6] }, 2],
    // The sparse-write shape: `arr[index] = value` on a short array.
    ["dish 3 entered first", { B: [null, null, 1.2] }, 3],
    ["the highest index across different columns wins", { B: [1], C: [1, 2, 3, 4] }, 4],
    ["a stray value in dish 5 only", { B: [null, null, null, null, 9] }, 5],
    ["a non-array column is ignored", { B: "nonsense" as unknown as AnswerValue }, 0],
  ])("is %s -> %i", (_label, values, expected) => {
    expect(activeDishCount(group, values as Record<string, AnswerValue>)).toBe(expected);
  });

  it("clamps to the group's count", () => {
    const longer = { B: Array.from({ length: 20 }, (_, i) => i) } as Record<
      string,
      AnswerValue
    >;
    expect(activeDishCount(group, longer)).toBe(8);
  });
});

describe("normalizeDishColumns", () => {
  it("returns the very same object for a non-dish-run form", () => {
    const values = { x: 1 } as Record<string, AnswerValue>;
    expect(normalizeDishColumns(labForm({ dishRun: false }), values)).toBe(values);
  });

  it("empties every column when no dish has been touched", () => {
    expect(
      normalizeDishColumns(labForm(), { B: [null, null, null], C: [], operator: "Ada" }),
    ).toEqual({ B: [], C: [], D: [], operator: "Ada" });
  });

  // THE ALIGNMENT CASE. Entering dish 3 first leaves `[null, null, 1.2]`; every
  // other column must be brought to the same length or `zip` truncates.
  it("pads every column to the same length when one dish is entered out of order", () => {
    expect(normalizeDishColumns(labForm(), { B: [null, null, 1.2] })).toEqual({
      B: [null, null, 1.2],
      C: [null, null, null],
      D: [null, null, null],
    });
  });

  // THE ZIP-TRUNCATION REGRESSION. Per-column trimming would give B length 3 and
  // C length 2, and `zip` would silently drop dish 3.
  it("keeps a partially measured dish aligned across columns", () => {
    const out = normalizeDishColumns(labForm(), {
      B: [1, 2, 3],
      C: [4, 5],
      D: [6, 7],
    });
    expect(out).toEqual({
      B: [1, 2, 3],
      C: [4, 5, null],
      D: [6, 7, null],
    });
    for (const id of ["B", "C", "D"]) {
      expect((out[id] as unknown[]).length).toBe(3);
    }
  });

  it("drops entries past the group's count", () => {
    const out = normalizeDishColumns(labForm({ count: 2 }), { B: [1, 2, 3, 4], C: [1, 2] });
    expect(out).toEqual({ B: [1, 2], C: [1, 2], D: [null, null] });
  });

  // THE CONTAINMENT TEST: a dish-run template may carry an unrelated group.
  it("leaves an unrelated repeatable group untouched", () => {
    const out = normalizeDishColumns(labForm({ extraGroup: true }), {
      B: [1, 2],
      retained: [5, null, null, null],
    });
    expect(out.retained).toEqual([5, null, null, null]);
  });

  it("does not mutate its input", () => {
    const values = { B: [null, null, 1.2] } as Record<string, AnswerValue>;
    const snapshot = JSON.stringify(values);
    normalizeDishColumns(labForm(), values);
    expect(JSON.stringify(values)).toBe(snapshot);
  });

  it("is idempotent", () => {
    const once = normalizeDishColumns(labForm(), { B: [1, 2, 3], C: [4, 5] });
    expect(normalizeDishColumns(labForm(), once)).toEqual(once);
  });

  it("coerces a non-array column into a correctly sized column", () => {
    expect(
      normalizeDishColumns(labForm(), {
        B: [1, 2],
        C: "nonsense" as unknown as AnswerValue,
      }),
    ).toEqual({ B: [1, 2], C: [null, null], D: [null, null] });
  });
});
