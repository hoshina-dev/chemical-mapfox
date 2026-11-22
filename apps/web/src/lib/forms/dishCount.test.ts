import { expect, it } from "vitest";

import { withDishCount } from "./dishCount";

const group = (id: string, count: number) => ({
  id,
  type: "repeatable-group",
  label: "Dish",
  config: { count, itemLabel: "Dish", questions: [{ id: "a", type: "number", label: "a" }] },
});

it("copies Max dishes into the dish group's count", () => {
  const template = {
    labForm: {
      name: "concentration",
      dishRun: { group: "dishes", maxDishes: 8, rules: [], calculations: [] },
      questions: [{ id: "analyst", type: "string", label: "Analyst" }, group("dishes", 4)],
    },
    clientForm: { name: "Client form", questions: [] },
  };
  const saved = withDishCount(template);
  expect(saved.labForm.questions[1]).toEqual(group("dishes", 8));
  expect(saved.labForm.questions[0]).toBe(template.labForm.questions[0]);
  expect(template.labForm.questions[1].config.count).toBe(4); // input untouched
});

it("leaves other repeatable groups and templates without a dish run alone", () => {
  const withOtherGroup = {
    labForm: { dishRun: { group: "dishes", maxDishes: 6 }, questions: [group("samples", 3)] },
  };
  expect(withDishCount(withOtherGroup).labForm.questions[0]).toEqual(group("samples", 3));
  const plain = { labForm: { questions: [group("dishes", 4)] } };
  expect(withDishCount(plain)).toBe(plain);
  expect(withDishCount({ name: "no forms" })).toEqual({ name: "no forms" });
});
