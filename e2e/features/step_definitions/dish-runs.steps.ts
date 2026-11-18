import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";

import {
  findTicket,
  type TemplateBody,
} from "../support/stub/modules/sample-tracker.js";
import { seedTicketFor } from "../support/tickets.js";
import type { ChemFoxWorld } from "../support/world.js";

// Dish runs: the lab form reveals dishes one at a time, compares them pairwise
// against the acceptable error, and only lets the experiment finish once a pair
// agrees. The engine is the real one (Pyodide in the browser), so these
// scenarios prove the UI and the gate — the arithmetic is Python's own.

/** Dishes allowed; the group's `count` must be at least this. */
const MAX_DISHES = 3;

/** Pyodide is downloaded on the first evaluation of the session. */
const ENGINE_TIMEOUT = 180_000;

/**
 * The method's formulas exactly as the builder generates them (see
 * `apps/web/src/lib/forms/dishFormula.ts`), because the browser engine runs
 * them for real: `G` is one value per dish, `accepted_pair` is the first pair
 * agreeing on every rule in index order — (1,2), (1,3), (2,3) — or `None`, and
 * `final_G` averages `G` over that pair. Rounding to 2 decimals happens before
 * the comparison, as the lab states its tolerance against the rounded value.
 */
const DISH_CALCULATIONS: NonNullable<TemplateBody["calculations"]> = {
  G: {
    formula:
      "[v0 + v1 if v0 is not None and v1 is not None else None for v0, v1 in zip(values['B'], values['C'])]",
  },
  accepted_pair: {
    formula: [
      "pairs = [(0, 1), (0, 2), (1, 2)]",
      "ok = [p for p in pairs if p[1] < len(G) and G[p[0]] is not None and G[p[1]] is not None and round(abs(round(G[p[0]], 2) - round(G[p[1]], 2)), 2) <= 0.3]",
      "[ok[0][0], ok[0][1]] if ok else None",
    ].join("\n"),
  },
  final_G: {
    formula:
      "round((G[accepted_pair[0]] + G[accepted_pair[1]]) / 2, 2) if accepted_pair else None",
  },
};

const DISH_BODY: TemplateBody = {
  labForm: {
    name: "Lab form",
    questions: [
      {
        id: "dishes",
        type: "repeatable-group",
        label: "Dish",
        config: {
          count: MAX_DISHES,
          itemLabel: "Dish",
          questions: [
            { id: "B", type: "number", label: "Mass before drying (g)" },
            { id: "C", type: "number", label: "Mass after drying (g)" },
          ],
        },
      },
    ],
    dishRun: {
      group: "dishes",
      maxDishes: MAX_DISHES,
      calculations: [{ name: "G", expression: "B + C" }],
      rules: [
        {
          target: "G",
          label: "G",
          limit: { kind: "absolute", value: 0.3 },
          decimals: 2,
        },
      ],
      finals: ["G"],
    },
  },
  calculations: DISH_CALCULATIONS,
};

/**
 * A started dish-run experiment with dishes 1 and 2 measured. `B` is the same
 * on both dishes, so `secondC` alone decides whether they agree.
 */
function seedDishRun(contextId: string, secondC: number): void {
  seedTicketFor(undefined, {
    id: contextId,
    name: `Experiment ${contextId}`,
    stage: "IN_PROGRESS",
    methods: [
      {
        name: "Moisture (dishes)",
        body: DISH_BODY,
        values: { B: [4, 4], C: [4.42, secondC] },
      },
    ],
  });
}

// --- data setup ----------------------------------------------------------

Given(
  "a dish-run experiment {string} whose first two dishes agree",
  function (this: ChemFoxWorld, contextId: string) {
    // G = 8.42 and 8.55: a difference of 0.13, inside the 0.3 acceptable error.
    seedDishRun(contextId, 4.55);
  },
);

Given(
  "a dish-run experiment {string} whose first two dishes disagree",
  function (this: ChemFoxWorld, contextId: string) {
    // G = 8.42 and 8.90: a difference of 0.48, outside the 0.3 acceptable error.
    seedDishRun(contextId, 4.9);
  },
);

// --- actions -------------------------------------------------------------

When("I compare the dishes", async function (this: ChemFoxWorld) {
  const compare = this.page.getByRole("button", {
    name: "Compare the dishes",
    exact: true,
  });
  // The panel renders only once a comparison exists, and the one it runs on
  // mount has to download the engine first.
  await compare.waitFor({ state: "visible", timeout: ENGINE_TIMEOUT });
  // Re-comparing is idempotent, and a click while the button is in its loading
  // state is a no-op, so this is safe whether or not the first run has landed.
  await compare.click({ timeout: 5_000 }).catch(() => {});
  await this.page
    .getByText("Up to date with the measurements below.", { exact: true })
    .waitFor({ state: "visible", timeout: ENGINE_TIMEOUT });
});

// --- assertions ----------------------------------------------------------

Then(
  "the dish run should say {string}",
  async function (this: ChemFoxWorld, text: string) {
    await this.page
      .getByText(text, { exact: true })
      .waitFor({ state: "visible", timeout: 30_000 });
  },
);

Then(
  "dishes {int} and {int} should be the accepted pair",
  async function (this: ChemFoxWorld, a: number, b: number) {
    const row = this.page
      .getByRole("row")
      .filter({ hasText: `${a} and ${b}` });
    await row
      .getByText("Accepted", { exact: true })
      .waitFor({ state: "visible", timeout: 30_000 });
  },
);

Then(
  "a result should be reported for the accepted pair",
  async function (this: ChemFoxWorld) {
    await this.page
      .getByText(/^Final result, from dishes \d+ and \d+$/)
      .waitFor({ state: "visible", timeout: 30_000 });
  },
);

Then(
  "dish {int} should be offered for measuring",
  async function (this: ChemFoxWorld, dish: number) {
    await this.page
      .getByRole("tab", { name: `Dish ${dish}`, exact: true })
      .waitFor({ state: "visible", timeout: 30_000 });
  },
);

Then(
  "finishing the experiment should be blocked",
  async function (this: ChemFoxWorld) {
    const finish = this.page.getByRole("button", {
      name: "Finish experiment",
      exact: true,
    });
    await finish.waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(
      await finish.isDisabled(),
      true,
      "Finish experiment should stay disabled while no two dishes agree",
    );
  },
);

Then(
  "the dish run panel should not be shown",
  async function (this: ChemFoxWorld) {
    // Wait for the editor itself first, or this would pass against a page that
    // has simply not rendered yet.
    await this.page
      .getByRole("button", { name: "Finish experiment", exact: true })
      .waitFor({ state: "visible", timeout: 60_000 });
    assert.equal(
      await this.page
        .getByRole("button", { name: "Compare the dishes", exact: true })
        .count(),
      0,
      "an ordinary method should have no dish run panel",
    );
  },
);

Then(
  "sample_tracker should have stored a reported result for {string}",
  function (this: ChemFoxWorld, contextId: string) {
    const calcs = findTicket(contextId)?.experiments[0].context.calculations as
      | Record<string, { result?: unknown }>
      | undefined;
    // The reported figure is the engine's own `final_*`, so the panel and the
    // certificate can never disagree.
    const final = calcs?.final_G?.result;
    assert.ok(
      final !== undefined && final !== null && final !== "",
      `final_G has no stored result (got ${JSON.stringify(final)})`,
    );
    const pair = calcs?.accepted_pair?.result;
    assert.ok(
      Array.isArray(pair) && pair.length === 2,
      `accepted_pair should be a pair of dish indexes, got ${JSON.stringify(pair)}`,
    );
  },
);
