import { describe, expect, it } from "vitest";

import { mapCalculationsToApi, parseTemplate, templateToCalculationDryRun } from "./templates";

const labForm = {
  name: "Lab",
  description: null,
  questions: [{ id: "mass", type: "number", label: "Mass (g)", description: null }],
};

describe("parseTemplate", () => {
  it("reads stored JSON: nulls dropped, string formulas and blank results normalized", () => {
    const { template, valid, wireSnapshot } = parseTemplate({
      clientForm: null,
      labForm: labForm as never,
      calculations: {
        doubled: "values['mass'] * 2",
        halved: { formula: "values['mass'] / 2", result: "" },
        kept: { formula: "1 + 1", result: 2 },
      },
    });
    expect(valid).toBe(true);
    expect(template.clientForm).toEqual({ name: "", questions: [] });
    expect(template.labForm.questions[0]).toEqual({ id: "mass", type: "number", label: "Mass (g)" });
    expect(template.calculations).toEqual({
      doubled: { formula: "values['mass'] * 2" },
      halved: { formula: "values['mass'] / 2" },
      kept: { formula: "1 + 1", result: 2 },
    });
    // the stored form is kept as it came
    expect(wireSnapshot.calculations.doubled).toBe("values['mass'] * 2");
  });

  it("returns a best-effort template marked invalid when it does not match the schema", () => {
    const parsed = parseTemplate({
      labForm: { name: "Lab", questions: [{ id: "x", type: "no-such-type", label: "X" }] } as never,
    });
    expect(parsed.valid).toBe(false);
    expect(parsed.template.labForm.questions).toHaveLength(1);
  });
});

describe("calculations out", () => {
  const template = parseTemplate({
    labForm: labForm as never,
    calculations: { a: { formula: "1", result: 1 }, b: { formula: "a + 1" } },
  }).template;

  it("saves a result only where there is one", () => {
    expect(mapCalculationsToApi(template.calculations)).toEqual({
      a: { formula: "1", result: 1 },
      b: { formula: "a + 1" },
    });
  });

  it("dry-runs the formulas without previous results", () => {
    const body = templateToCalculationDryRun(template, { mass: 3 });
    expect(body.calculations).toEqual({ a: { formula: "1" }, b: { formula: "a + 1" } });
    expect(body.values).toEqual({ mass: 3 });
  });
});
