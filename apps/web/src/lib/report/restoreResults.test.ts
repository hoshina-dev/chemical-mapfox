import { expect, it } from "vitest";

import type { FormDraft } from "@/lib/builder";

import { restoreResults } from "./restoreResults";

const form = (dishRun?: FormDraft["labForm"]["dishRun"]) => ({
  name: "Lab form",
  questions: [],
  ...(dishRun ? { dishRun } : {}),
});
const draft = (over: Partial<FormDraft>): FormDraft => ({
  title: "Moisture",
  clientForm: form(),
  labForm: form(),
  calculations: [],
  ...over,
});

it("brings back a deleted calculation at its place and keeps every other edit", () => {
  const saved = draft({
    calculations: [
      { name: "moisture", formula: "a - b" },
      { name: "dry", formula: "b" },
    ],
  });
  const edited = draft({
    title: "Moisture",
    description: "new text",
    calculations: [{ name: "dry", formula: "b * 2" }],
  });
  const { draft: back, restored } = restoreResults(edited, saved, ["moisture"]);
  expect(restored).toEqual(["moisture"]);
  expect(back.calculations).toEqual([
    { name: "moisture", formula: "a - b" },
    { name: "dry", formula: "b * 2" },
  ]);
  expect(back.description).toBe("new text");
});

it("brings back a dish run's final_<target> and the per-dish calculation behind it", () => {
  const run = {
    group: "dishes",
    maxDishes: 8,
    rules: [],
    calculations: [{ name: "c", expression: "a + b" }],
    finals: ["a", "c"],
  };
  const saved = draft({ labForm: form(run) });
  const edited = draft({ labForm: form({ ...run, calculations: [], finals: ["a"] }) });
  const { draft: back, restored } = restoreResults(edited, saved, ["final_c"]);
  expect(restored).toEqual(["final_c"]);
  expect(back.labForm.dishRun?.finals).toEqual(["a", "c"]);
  expect(back.labForm.dishRun?.calculations).toEqual([{ name: "c", expression: "a + b" }]);
});

it("leaves out what it cannot bring back", () => {
  const run = { group: "dishes", maxDishes: 8, rules: [], finals: ["a"] };
  const saved = draft({ labForm: form(run) });
  const dishRunOff = draft({});
  expect(restoreResults(dishRunOff, saved, ["final_a", "unknown"]).restored).toEqual([]);
});
