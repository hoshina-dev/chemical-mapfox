import { describe, expect, it } from "vitest";

import { evaluateDishRun } from "./dishRun";

// The hard coal methods' precision rules, checked against the lab's workbook ("Latest
// Report … Harper Analytics", sample 12/26): the per-dish values of each sheet and its
// "Precyzja" column (OK / Powtórz). The seeded experiment-manager templates use these rules.
const methods = [
  { method: "Wilgoć całkowita (Wtr)", target: "Wtr", limit: 0.3, decimals: 1, dishes: [14.5467, 14.2667] },
  { method: "Wilgoć analityczna (Wa)", target: "Wa", limit: 0.1, decimals: 2, dishes: [3.0861, 3.1364] },
  { method: "Popiół (A)", target: "A", limit: 0.2, decimals: 2, dishes: [46.6067, 46.7486] },
  { method: "Chlor (Cl)", target: "Cl", limit: 0.03, decimals: 2, dishes: [0.21095, 0.20305] },
  { method: "Ciepło spalania (Qs, z aparatu)", target: "Qs", limit: 120, dishes: [15214, 15271] },
] as const;

function run(m: (typeof methods)[number], dishes: readonly number[]) {
  return evaluateDishRun({
    rules: [
      {
        target: m.target,
        label: m.target,
        limit: m.limit,
        result: [...dishes],
        ...("decimals" in m ? { decimals: m.decimals } : {}),
      },
    ],
    activeDishCount: dishes.length,
    maxDishes: 8,
  });
}

describe("hard coal dish runs, as the lab's workbook", () => {
  it.each(methods)("$method: the sheet's two dishes agree (OK)", (m) => {
    const state = run(m, m.dishes);
    expect(state.acceptedPair).toEqual([1, 2]);
  });

  it.each(methods)("$method: two dishes beyond the limit ask for a third (Powtórz)", (m) => {
    const [first] = m.dishes;
    const state = run(m, [first, first + m.limit * 2]);
    expect(state.acceptedPair).toBeNull();
    expect(state.nextDish).toBe(3);
  });
});
