import type { ExperimentTemplate, Question } from "@repo/forms";
import { describe, expect, it } from "vitest";

import { inspectFormulas, standInValues } from "./formulas";

function template(
  questions: Question[],
  calculations: ExperimentTemplate["calculations"],
  clientQuestions: Question[] = [],
): ExperimentTemplate {
  return {
    clientForm: { name: "Client", questions: clientQuestions },
    labForm: { name: "Lab", questions },
    calculations,
  };
}

const mass: Question = { id: "mass", type: "number", label: "Mass", config: { min: 0 } };

describe("inspectFormulas", () => {
  it("accepts values['id'], other calculations, builtins, and keywords", () => {
    const issues = inspectFormulas(
      template(
        [mass, { id: "reading", type: "number", label: "Reading" }],
        {
          loss: { formula: "values['mass'] - 1" },
          pct: {
            formula: "round(100 * loss / values['mass'], 1) if values['mass'] else 0  # note",
          },
          label: { formula: "note = 'mass'\nresult = note" },
        },
      ),
    );
    expect(issues).toEqual([]);
  });

  it("accepts a repeatable child as a list and rejects the group id", () => {
    const group: Question = {
      id: "reps",
      type: "repeatable-group",
      label: "Reps",
      config: {
        count: 2,
        questions: [{ id: "reading", type: "number", label: "Reading" }],
      },
    };
    expect(
      inspectFormulas(template([group], { avg: { formula: "sum(values['reading']) / len(values['reading'])" } })),
    ).toEqual([]);
    expect(
      inspectFormulas(template([group], { bad: { formula: "values['reps']" } })).map((issue) => issue.message),
    ).toEqual(["Calculation 'bad' reads values['reps'], which is not a question id."]);
  });

  it("rejects duplicate ids, dunders, unknown names, cycles, and shadowed names", () => {
    const issues = inspectFormulas(
      template(
        [mass, { ...mass, id: "mass" }],
        {
          mass: { formula: "values['mass']" },
          round: { formula: "values['nope'] + __import__ + bare" },
          a: { formula: "b + 1" },
          b: { formula: "a + 1" },
        },
      ),
    );
    const messages = issues.map((issue) => issue.message);
    expect(messages.some((message) => message.includes("used 2 times"))).toBe(true);
    expect(messages.some((message) => message.includes("also a question id"))).toBe(true);
    expect(messages.some((message) => message.includes("a formula builtin"))).toBe(true);
    expect(messages.some((message) => message.includes("dunder"))).toBe(true);
    expect(messages.some((message) => message.includes("values['nope']"))).toBe(true);
    expect(messages.some((message) => message.includes("uses 'bare'"))).toBe(true);
    expect(messages.filter((message) => message.includes("Circular"))).toHaveLength(2);
  });

  // A per-dish formula is a comprehension over a repeatable-group's columns, so
  // its loop targets are bound by the engine and must not read as unknown names.
  // Before this, every dish-run template was unsaveable (`inspectFormulas` gates
  // saving in `onboarding.ts`).
  describe("comprehension and loop targets are local", () => {
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
          { id: "D", type: "number", label: "D" },
        ],
      },
    };

    it.each([
      ["single target", "[b * 2 for b in values['B']]"],
      ["tuple target", "[b + c for b, c in zip(values['B'], values['C'])]"],
      ["parenthesised target", "[b + c for (b, c) in zip(values['B'], values['C'])]"],
      [
        "three targets with null guards (what the dish-run generator emits)",
        "[b + c * d if b is not None and c is not None and d is not None else None" +
          " for b, c, d in zip(values['B'], values['C'], values['D'])]",
      ],
      ["statement loop", "total = 0\nfor b in values['B']:\n    total = total + b\nresult = total"],
    ])("accepts a %s", (_label, formula) => {
      expect(inspectFormulas(template([dishes], { G: { formula } }))).toEqual([]);
    });

    it("still reports a genuinely unknown name alongside bound targets", () => {
      const messages = inspectFormulas(
        template([dishes], {
          G: { formula: "[b + typo for b in values['B']]" },
        }),
      ).map((issue) => issue.message);
      expect(messages).toEqual([
        "Calculation 'G' uses 'typo', which is not a calculation, a builtin, or math. Answers must be values['…'].",
      ]);
    });

    it("still rejects a dunder inside a comprehension", () => {
      const messages = inspectFormulas(
        template([dishes], {
          G: { formula: "[b.__class__ for b in values['B']]" },
        }),
      ).map((issue) => issue.message);
      expect(messages.some((message) => message.includes("dunder"))).toBe(true);
    });

    // A chained per-dish calculation refers to earlier ones by bare name.
    it("accepts a chain of per-dish calculations referring to each other", () => {
      expect(
        inspectFormulas(
          template([dishes], {
            E: { formula: "[b + c for b, c in zip(values['B'], values['C'])]" },
            F: { formula: "[c * d for c, d in zip(values['C'], values['D'])]" },
            G: { formula: "[e + f for e, f in zip(E, F)]" },
          }),
        ),
      ).toEqual([]);
    });
  });
});

describe("standInValues", () => {
  it("uses defaults, then a non-zero stand-in, and lets a trial override", () => {
    const questions: Question[] = [
      { id: "with_default", type: "number", label: "D", config: { default: 4 } },
      { id: "from_min", type: "number", label: "M", config: { min: 3 } },
      mass,
      { id: "slide", type: "slider", label: "S", config: { min: 0, max: 10 } },
      { id: "slide_min", type: "slider", label: "S2", config: { min: 5, max: 10 } },
      { id: "choice", type: "select-string", label: "C", config: { options: [{ label: "A", value: "a" }] } },
      { id: "empty_choice", type: "radio", label: "R", config: { options: [] } },
      { id: "nchoice", type: "select-number", label: "N", config: { options: [{ label: "Two", value: 2 }] } },
      { id: "empty_n", type: "select-number", label: "N2", config: { options: [] } },
      { id: "multi", type: "multi-select", label: "M", config: { options: [{ label: "A", value: "a" }] } },
      { id: "checks", type: "checkbox-group", label: "K", config: { options: [] } },
      { id: "seg", type: "segmented", label: "G", config: { options: [{ label: "A", value: "a" }] } },
      { id: "flag", type: "boolean", label: "F" },
      { id: "flag_on", type: "boolean", label: "F2", config: { default: true } },
      { id: "stars", type: "rating", label: "R" },
      { id: "swatch", type: "color", label: "C" },
      { id: "when", type: "date", label: "D" },
      { id: "today", type: "date", label: "D2", config: { default: "today" } },
      { id: "clock", type: "time", label: "T" },
      { id: "stamp", type: "datetime", label: "T2" },
      { id: "tags", type: "tags", label: "Tags" },
      { id: "note", type: "string", label: "Note" },
      { id: "long", type: "textarea", label: "Long" },
      { id: "secret", type: "password", label: "Secret" },
      {
        id: "reps",
        type: "repeatable-group",
        label: "Reps",
        config: { count: 2, questions: [{ id: "reading", type: "number", label: "Reading", config: { min: 0 } }] },
      },
    ];
    const values = standInValues(template(questions, {}), { mass: 9 });
    expect(values.with_default).toBe(4);
    expect(values.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(values.from_min).toBe(3);
    expect(values.mass).toBe(9);
    expect(values.slide).toBe(1);
    expect(values.slide_min).toBe(5);
    expect(values.choice).toBe("a");
    expect(values.empty_choice).toBe("sample");
    expect(values.nchoice).toBe(2);
    expect(values.empty_n).toBe(1);
    expect(values.multi).toEqual(["a"]);
    expect(values.checks).toEqual([]);
    expect(values.seg).toBe("a");
    expect(values.flag).toBe(false);
    expect(values.flag_on).toBe(true);
    expect(values.stars).toBe(1);
    expect(values.swatch).toBe("#000000");
    expect(values.when).toBe("2026-01-01");
    expect(values.clock).toBe("00:00");
    expect(values.stamp).toBe("2026-01-01T00:00");
    expect(values.tags).toEqual(["sample"]);
    expect(values.note).toBe("sample");
    expect(values.long).toBe("sample");
    expect(values.secret).toBe("sample");
    expect(values.reading).toEqual([1, 1]);
    expect(values.reps).toBeUndefined();
  });

  // A dish column is never padded to `count` in production — it is exactly as
  // long as the dishes touched — so the stand-in must not pad either, or a
  // formula could pass the authoring check and still fail in the lab.
  describe("dish groups get the production shape", () => {
    function dishTemplate(count: number, extraGroup = false): ExperimentTemplate {
      const dishes: Question = {
        id: "dishes",
        type: "repeatable-group",
        label: "Dish",
        config: {
          count,
          itemLabel: "Dish",
          questions: [
            { id: "B", type: "number", label: "B" },
            { id: "C", type: "number", label: "C" },
          ],
        },
      };
      const sieves: Question = {
        id: "sieves",
        type: "repeatable-group",
        label: "Sieve",
        config: {
          count: 4,
          questions: [{ id: "retained", type: "number", label: "Retained" }],
        },
      };
      return {
        clientForm: { name: "Client", questions: [] },
        labForm: {
          name: "Lab",
          questions: extraGroup ? [dishes, sieves] : [dishes],
          dishRun: {
            group: "dishes",
            maxDishes: count,
            rules: [{ target: "G", label: "G", limit: { kind: "absolute", value: 0.3 } }],
          },
        },
        calculations: {},
      };
    }

    it("stands in two measured dishes plus one being measured", () => {
      const values = standInValues(dishTemplate(8));
      expect(values.B).toEqual([1, 1, null]);
      expect(values.C).toEqual([1, 1, null]);
    });

    it("keeps two measured dishes when the cap is only two", () => {
      const values = standInValues(dishTemplate(2));
      expect(values.B).toEqual([1, 1]);
    });

    it("leaves an unrelated repeatable group padded to its own count", () => {
      const values = standInValues(dishTemplate(8, true));
      expect(values.B).toEqual([1, 1, null]);
      expect(values.retained).toEqual([1, 1, 1, 1]);
    });

    it("still lets a trial override a dish column", () => {
      const values = standInValues(dishTemplate(8), { B: [2, 3] });
      expect(values.B).toEqual([2, 3]);
    });
  });
});
