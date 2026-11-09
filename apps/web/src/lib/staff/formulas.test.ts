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
});
