import assert from "node:assert/strict";

import { Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import { clickUntil, setInput } from "../support/interactions.js";
import type { ChemFoxWorld } from "../support/world.js";

/** Placeholders are the only stable handles on these two controls: the name
 * input's label ("Name") collides with the template metadata field, and the
 * formula editor is a `react-simple-code-editor` textarea with no label. */
const CALC_NAME_PLACEHOLDER = "totalCost";
const FORMULA_PLACEHOLDER = "mean(values['reading_a'])";

function calcNameInputs(world: ChemFoxWorld): Locator {
  return world.page.getByPlaceholder(CALC_NAME_PLACEHOLDER);
}

function formulaInputs(world: ChemFoxWorld): Locator {
  return world.page.getByPlaceholder(FORMULA_PLACEHOLDER);
}

/** The results table row for one calculation, found by its name cell. */
function resultRow(world: ChemFoxWorld, name: string): Locator {
  return world.page
    .getByRole("row")
    .filter({ has: world.page.getByText(name, { exact: true }) });
}

When(
  "I add a calculation {string} with formula {string}",
  async function (this: ChemFoxWorld, name: string, formula: string) {
    const existing = await calcNameInputs(this).count();
    await clickUntil(
      this,
      this.page.getByRole("button", { name: "Add calculation" }),
      async () => (await calcNameInputs(this).count()) > existing,
    );
    await setInput(this, calcNameInputs(this).nth(existing), name);
    await setInput(this, formulaInputs(this).nth(existing), formula);
  },
);

When("I open the live preview", async function (this: ChemFoxWorld) {
  const drawerTitle = this.page.getByText("Test calculations", { exact: true });
  await clickUntil(
    this,
    this.page.getByRole("button", { name: "Live preview" }),
    () => drawerTitle.isVisible(),
  );
});

When("I run the draft calculations", async function (this: ChemFoxWorld) {
  const table = this.page.getByRole("table", { name: "Test calculations" });
  await clickUntil(
    this,
    this.page.getByRole("button", { name: /^Run (calculations|again)$/ }),
    () => table.isVisible(),
  );
});

Then(
  "the calculation {string} should show the result {string}",
  async function (this: ChemFoxWorld, name: string, expected: string) {
    const row = resultRow(this, name);
    await row.waitFor({ state: "visible", timeout: 15_000 });
    await row
      .getByText(expected, { exact: true })
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

Then(
  "the calculation {string} should be marked {string}",
  async function (this: ChemFoxWorld, name: string, status: string) {
    const row = resultRow(this, name);
    await row.waitFor({ state: "visible", timeout: 15_000 });
    await row
      .getByText(status, { exact: true })
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

Then(
  "the calculation report should say {string}",
  async function (this: ChemFoxWorld, summary: string) {
    await this.page
      .getByText(summary, { exact: true })
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

Then(
  "I should see the missing-values warning for {string}",
  async function (this: ChemFoxWorld, questionId: string) {
    await this.page
      .getByText("Formulas expect values that were not supplied", {
        exact: true,
      })
      .waitFor({ state: "visible", timeout: 15_000 });
    const listed = this.page
      .getByRole("listitem")
      .filter({ hasText: questionId });
    await listed.first().waitFor({ state: "visible", timeout: 15_000 });
    assert.ok(
      (await listed.count()) > 0,
      `expected the warning to list "${questionId}"`,
    );
  },
);

Then(
  "I should see that there are no calculations to test",
  async function (this: ChemFoxWorld) {
    await this.page
      .getByText("This template has no calculations to test.", { exact: true })
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);
