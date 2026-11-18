import type { ExperimentTemplate, Question } from "@repo/forms";
import { describe, expect, it } from "vitest";

import { type FormDraft, fromDraft, toDraft } from "./builder";

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

function draft(
  calculations: { name: string; expression: string }[],
  handWritten: { name: string; formula: string }[] = [],
  finals?: string[],
): FormDraft {
  return {
    title: "Proximate",
    clientForm: { name: "Client", questions: [] },
    labForm: {
      name: "Lab",
      questions: [dishes],
      dishRun: {
        group: "dishes",
        maxDishes: 8,
        rules: [
          { target: "G", label: "G", limit: { kind: "absolute", value: 0.3 }, decimals: 2 },
        ],
        calculations,
        ...(finals === undefined ? {} : { finals }),
      },
    },
    calculations: handWritten,
  };
}

describe("fromDraft, dish calculations", () => {
  it("generates guarded per-dish Python from the authored expressions", () => {
    const { template } = fromDraft(
      draft([
        { name: "E", expression: "B + C" },
        { name: "F", expression: "C * D" },
        { name: "G", expression: "E + F" },
      ]),
    );
    expect(Object.keys(template.calculations).sort()).toEqual(["E", "F", "G"]);
    expect(template.calculations.E?.formula).toBe(
      "[v0 + v1 if v0 is not None and v1 is not None else None " +
        "for v0, v1 in zip(values['B'], values['C'])]",
    );
    // The one that matters: G chains two earlier calculations elementwise
    // instead of concatenating their lists.
    expect(template.calculations.G?.formula).toBe(
      "[v0 + v1 if v0 is not None and v1 is not None else None for v0, v1 in zip(E, F)]",
    );
  });

  it("lets a later calculation reference an earlier one but not a later one", () => {
    const { template } = fromDraft(
      draft([
        { name: "G", expression: "E + 1" },
        { name: "E", expression: "B + C" },
      ]),
    );
    // G is authored first, so E is not yet defined and G cannot be generated.
    expect(template.calculations.G).toBeUndefined();
    expect(template.calculations.E).toBeDefined();
  });

  it("skips an expression it cannot generate rather than guessing", () => {
    const { template } = fromDraft(draft([{ name: "G", expression: "B % C" }]));
    expect(template.calculations.G).toBeUndefined();
  });

  it("ignores an entry with no name yet", () => {
    const { template } = fromDraft(draft([{ name: "", expression: "B + C" }]));
    expect(template.calculations).toEqual({});
  });

  it("keeps hand-written formulas alongside generated ones", () => {
    const { template } = fromDraft(
      draft([{ name: "G", expression: "B + C" }], [{ name: "note", formula: "1 + 1" }]),
    );
    expect(template.calculations.note?.formula).toBe("1 + 1");
    expect(template.calculations.G?.formula).toContain("zip");
  });

  it("lets a generated formula win over a stale hand-written one of the same name", () => {
    const { template } = fromDraft(
      draft([{ name: "G", expression: "B + C" }], [{ name: "G", formula: "old" }]),
    );
    expect(template.calculations.G?.formula).toContain("zip");
  });

  it("generates nothing for a template with no dish run", () => {
    const plain: FormDraft = {
      title: "Plain",
      clientForm: { name: "Client", questions: [] },
      labForm: { name: "Lab", questions: [] },
      calculations: [{ name: "x", formula: "1" }],
    };
    expect(fromDraft(plain).template.calculations).toEqual({ x: { formula: "1" } });
  });
});

describe("fromDraft, reported values", () => {
  const chain = [
    { name: "E", expression: "B + C" },
    { name: "G", expression: "E + D" },
  ];

  it("generates an accepted-pair calculation and one final per reported value", () => {
    const { template } = fromDraft(draft(chain, [], ["G", "B"]));
    expect(Object.keys(template.calculations).sort()).toEqual([
      "E",
      "G",
      "accepted_pair",
      "final_B",
      "final_G",
    ]);
  });

  // This is what makes the value usable: a calculation shows up in the PDF
  // report's variable list, whereas a key written into `values` does not.
  it("averages the quantity over the accepted pair", () => {
    const { template } = fromDraft(draft(chain, [], ["G"]));
    expect(template.calculations.final_G?.formula).toBe(
      "round((G[accepted_pair[0]] + G[accepted_pair[1]]) / 2, 2) if accepted_pair else None",
    );
  });

  it("reports a measurement by reading its column", () => {
    const { template } = fromDraft(draft(chain, [], ["B"]));
    expect(template.calculations.final_B?.formula).toBe(
      "(values['B'][accepted_pair[0]] + values['B'][accepted_pair[1]]) / 2 " +
        "if accepted_pair else None",
    );
  });

  it("searches pairs in the order the lab works through them", () => {
    const { template } = fromDraft(draft(chain, [], ["G"]));
    const formula = template.calculations.accepted_pair?.formula ?? "";
    expect(formula).toContain("pairs = [(0, 1), (0, 2), (1, 2), (0, 3)");
    // Inclusive limit, and the difference rounded to the stated precision so an
    // exactly-at-limit pair is not lost to float noise.
    expect(formula).toContain(
      "round(abs(round(G[p[0]], 2) - round(G[p[1]], 2)), 2) <= 0.3",
    );
    expect(formula).toContain("[ok[0][0], ok[0][1]] if ok else None");
  });

  // All comparisons must pass for a pair to be accepted, so there is still one
  // accepted pair per experiment — several rules narrow it, they do not each
  // choose their own.
  it("requires every comparison to pass when a method has more than one", () => {
    const { template } = fromDraft({
      ...draft(chain, [], ["G"]),
      labForm: {
        ...draft(chain, [], ["G"]).labForm,
        dishRun: {
          group: "dishes",
          maxDishes: 8,
          calculations: chain,
          finals: ["G"],
          rules: [
            { target: "G", label: "G", limit: { kind: "absolute", value: 0.3 }, decimals: 2 },
            { target: "B", label: "B", limit: { kind: "absolute", value: 0.05 } },
          ],
        },
      },
    });
    const formula = template.calculations.accepted_pair?.formula ?? "";
    // Both quantities constrain the same pair, joined by `and`.
    expect(formula).toContain(
      "round(abs(round(G[p[0]], 2) - round(G[p[1]], 2)), 2) <= 0.3",
    );
    expect(formula).toContain(
      "abs(values['B'][p[0]] - values['B'][p[1]]) <= 0.05",
    );
    expect(formula).toContain("p[1] < len(values['B'])");
    expect(formula.split(" and ").length).toBeGreaterThan(6);
  });

  it("generates nothing when no value is reported", () => {
    const { template } = fromDraft(draft(chain, [], []));
    expect(template.calculations.accepted_pair).toBeUndefined();
    expect(Object.keys(template.calculations).sort()).toEqual(["E", "G"]);
  });

  it("skips a reported name that is neither a measurement nor a calculation", () => {
    const { template } = fromDraft(draft(chain, [], ["nope"]));
    expect(template.calculations.final_nope).toBeUndefined();
  });

  it("keeps the generated calculations out of the raw calculations list", () => {
    const { meta, template } = fromDraft(draft(chain, [], ["G"]));
    expect(toDraft(meta, template).calculations).toEqual([]);
  });
});

describe("toDraft, dish calculations", () => {
  it("keeps dish formulas out of the raw calculations list", () => {
    // Otherwise the same formula would be editable in two places and the
    // expression could drift from the Python.
    const template: ExperimentTemplate = {
      clientForm: { name: "Client", questions: [] },
      labForm: {
        name: "Lab",
        questions: [dishes],
        dishRun: {
          group: "dishes",
          maxDishes: 8,
          rules: [],
          calculations: [{ name: "G", expression: "B + C" }],
        },
      },
      calculations: { G: { formula: "[generated]" }, note: { formula: "1 + 1" } },
    };
    const result = toDraft({ title: "T" }, template);
    expect(result.calculations).toEqual([{ name: "note", formula: "1 + 1" }]);
    expect(result.labForm.dishRun?.calculations).toEqual([
      { name: "G", expression: "B + C" },
    ]);
  });

  it("survives a round trip without losing the expressions", () => {
    const original = draft([
      { name: "E", expression: "B + C" },
      { name: "G", expression: "E * 2" },
    ]);
    const { meta, template } = fromDraft(original);
    const back = toDraft(meta, template);
    expect(back.labForm.dishRun?.calculations).toEqual(
      original.labForm.dishRun?.calculations,
    );
    // And regenerating from the reopened draft yields the same Python.
    expect(fromDraft(back).template.calculations).toEqual(template.calculations);
  });
});
