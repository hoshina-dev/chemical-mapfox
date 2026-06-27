import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import { seedFinalizingExperiment } from "../support/stub/modules/finalization.js";
import type { ChemFoxWorld } from "../support/world.js";

/**
 * Click `trigger` until `reveals` is visible. Mirrors the auth helper but gives
 * each click its own short timeout, so attempts against a control that is still
 * hydrating (or briefly disabled mid-transition) fail fast and retry rather than
 * blocking on actionability.
 */
async function clickUntilVisible(
  trigger: Locator,
  reveals: Locator,
  attempts = 30,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await trigger.click({ timeout: 1000 });
    } catch {
      // not hydrated / momentarily disabled — fall through and re-check
    }
    try {
      await reveals.waitFor({ state: "visible", timeout: 1000 });
      return;
    } catch {
      // not revealed yet — try again
    }
  }
  await reveals.waitFor({ state: "visible", timeout: 10_000 });
}

function calculateButton(world: ChemFoxWorld): Locator {
  return world.page.getByRole("button", { name: "Calculate", exact: true });
}

function generateButton(world: ChemFoxWorld): Locator {
  return world.page.getByRole("button", { name: "Generate report", exact: true });
}

function closeButton(world: ChemFoxWorld): Locator {
  return world.page.getByRole("button", { name: "Close ticket", exact: true });
}

// --- data setup ----------------------------------------------------------

Given(
  "a finalizing experiment {string} exists",
  function (this: ChemFoxWorld, contextId: string) {
    seedFinalizingExperiment(contextId);
  },
);

// --- navigation ----------------------------------------------------------

When(
  "I open the finalization workspace for {string}",
  async function (this: ChemFoxWorld, contextId: string) {
    await this.goto(`/internal/experiment/${contextId}`);
    // The Finalize card (with its Calculate button) confirms a FINALIZING ticket
    // rendered with its experiment context — the precondition for every action.
    await calculateButton(this).waitFor({ state: "visible", timeout: 30_000 });
  },
);

// --- calculations --------------------------------------------------------

When("I run the calculations", async function (this: ChemFoxWorld) {
  await clickUntilVisible(
    calculateButton(this),
    this.page.getByRole("button", { name: "Recalculate", exact: true }),
  );
});

Then(
  "the calculations should show a result of {string}",
  async function (this: ChemFoxWorld, value: string) {
    await clickUntilVisible(
      this.page.getByRole("tab", { name: /Calculations/ }),
      this.page.getByRole("cell", { name: value, exact: true }),
    );
  },
);

// --- report generation ---------------------------------------------------

When("I generate the report", async function (this: ChemFoxWorld) {
  await clickUntilVisible(
    generateButton(this),
    this.page.getByText(/Report:\s*(Queued|Generating|Ready)/),
  );
});

Then("the report should reach the ready state", async function (this: ChemFoxWorld) {
  // The "View report" control only renders once the report status is success,
  // so its appearance is the user-visible proof the poll loop reached success.
  await this.page
    .getByRole("link", { name: "View report", exact: true })
    .waitFor({ state: "visible", timeout: 45_000 });
});

Then("I should be able to download the report", async function (this: ChemFoxWorld) {
  const download = this.page.getByRole("link", { name: "Download", exact: true });
  await download.waitFor({ state: "visible", timeout: 15_000 });
  const href = await download.getAttribute("href");
  assert.ok(href && href.includes("/report"), `unexpected download href: ${href}`);
});

// --- closing the ticket --------------------------------------------------

Then("I cannot close the ticket yet", async function (this: ChemFoxWorld) {
  const button = closeButton(this);
  await button.waitFor({ state: "visible", timeout: 15_000 });
  assert.equal(await button.isDisabled(), true);
});

When("I close the ticket", async function (this: ChemFoxWorld) {
  const dialog = this.page.getByRole("dialog");
  await clickUntilVisible(closeButton(this), dialog);
  await dialog
    .getByRole("button", { name: "Close ticket", exact: true })
    .click({ timeout: 15_000 });
});

Then("the ticket should be closed", async function (this: ChemFoxWorld) {
  // Once CLOSED the FINALIZING actions are replaced by the read-only report
  // panel, whose "Download PDF" link is unique to the closed state.
  await this.page
    .getByRole("link", { name: "Download PDF", exact: true })
    .waitFor({ state: "visible", timeout: 30_000 });
});
