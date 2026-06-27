import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import { pdfBuilderState, seed } from "../support/stub/modules/pdf-builder.js";
import type { ChemFoxWorld } from "../support/world.js";

const EDITOR_PATH = `/internal/experiment/onboarding/${seed.sampleId}/${seed.templateId}/pdf`;
const CONTENT_PLACEHOLDER = "Text (supports {{variables}})";

/**
 * Click `trigger` until `reveals` becomes visible. In dev mode React hydration
 * can lag a freshly navigated page, so a click on an interactive-only control is
 * a no-op until its handler attaches. Retrying the click absorbs that race.
 */
async function clickUntilVisible(
  trigger: Locator,
  reveals: Locator,
  attempts = 25,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    await trigger.click();
    try {
      await reveals.waitFor({ state: "visible", timeout: 1000 });
      return;
    } catch {
      // not hydrated yet — try again
    }
  }
  await reveals.waitFor({ state: "visible", timeout: 5000 });
}

/** Open a Mantine Select (matched by its current value) and pick an option. */
async function chooseOption(
  world: ChemFoxWorld,
  trigger: Locator,
  optionName: string | RegExp,
  attempts = 25,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    await trigger.click();
    const option = world.page.getByRole("option", { name: optionName });
    try {
      await option.waitFor({ state: "visible", timeout: 1000 });
      await option.click();
      return;
    } catch {
      // dropdown not hydrated/open yet — retry
    }
  }
  throw new Error(`option "${optionName}" never became selectable`);
}

// The seed is owned by the stub module (a single fixed sample + template); this
// step documents the precondition and keeps the Gherkin readable.
Given("a PDF template exists for editing", function (this: ChemFoxWorld) {
  // no-op: data is provided by features/support/stub/modules/pdf-builder.ts
});

When("I open the PDF editor", async function (this: ChemFoxWorld) {
  await this.goto(EDITOR_PATH);
  await this.page
    .getByText("PDF Template", { exact: true })
    .waitFor({ state: "visible", timeout: 30_000 });
});

Then("I should see the PDF editor toolbar", async function (this: ChemFoxWorld) {
  await this.page
    .getByRole("button", { name: "+ Text" })
    .waitFor({ state: "visible", timeout: 15_000 });
  await this.page
    .getByRole("button", { name: "Save", exact: true })
    .waitFor({ state: "visible", timeout: 15_000 });
});

When("I add a text component", async function (this: ChemFoxWorld) {
  await clickUntilVisible(
    this.page.getByRole("button", { name: "+ Text" }),
    this.page.getByPlaceholder(CONTENT_PLACEHOLDER),
  );
});

Then("I should see the component inspector", async function (this: ChemFoxWorld) {
  await this.page
    .getByPlaceholder(CONTENT_PLACEHOLDER)
    .waitFor({ state: "visible", timeout: 15_000 });
});

Then(
  "the layout should have unsaved changes",
  async function (this: ChemFoxWorld) {
    await this.page
      .getByText("Unsaved changes", { exact: true })
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

When("I save the layout", async function (this: ChemFoxWorld) {
  await clickUntilVisible(
    this.page.getByRole("button", { name: "Save", exact: true }),
    this.page.getByText("Saved", { exact: true }),
  );
});

Then("I should see the save confirmation", async function (this: ChemFoxWorld) {
  await this.page
    .getByText("Saved", { exact: true })
    .waitFor({ state: "visible", timeout: 15_000 });
});

Then(
  "the PDF template should have been saved",
  function (this: ChemFoxWorld) {
    assert.ok(
      pdfBuilderState().upsertCount > 0,
      "expected the upsert PDF template endpoint to have been called",
    );
  },
);

When(
  "I preview the experiment {string}",
  async function (this: ChemFoxWorld, name: string) {
    // Switch the preview mode Select from "Show placeholders" to "From experiment".
    await chooseOption(
      this,
      this.page.locator('input[value="Show placeholders"]'),
      "From experiment",
    );
    // Then pick the experiment from the (now visible) experiment Select.
    await chooseOption(
      this,
      this.page.getByPlaceholder("Pick experiment…"),
      new RegExp(name),
    );
  },
);

Then(
  "the canvas should show the previewed value {string}",
  async function (this: ChemFoxWorld, value: string) {
    await this.page
      .getByText(value, { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);
