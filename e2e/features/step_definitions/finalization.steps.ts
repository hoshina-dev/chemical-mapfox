import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";

import { clickUntil, waitForHydration } from "../support/interactions.js";
import { runtime } from "../support/runtime.js";
import { findTicket } from "../support/stub/modules/experiment-manager.js";
import { seedTicketFor } from "../support/tickets.js";
import type { ChemFoxWorld } from "../support/world.js";

// --- data setup ----------------------------------------------------------

Given(
  "an in-progress purity experiment {string} requested by {string}",
  function (this: ChemFoxWorld, contextId: string, email: string) {
    seedTicketFor(email, {
      id: contextId,
      name: "Coal proximate analysis",
      stage: "IN_PROGRESS",
      methods: [
        {
          name: "Purity",
          body: {
            labForm: {
              name: "Purity",
              questions: [
                { id: "mass_pure", type: "number", label: "Pure mass (g)" },
                { id: "mass_total", type: "number", label: "Total mass (g)" },
              ],
            },
            // Evaluated for real by the browser's Pyodide engine.
            calculations: {
              purity: { formula: "round(values['mass_pure'] / values['mass_total'] * 100)" },
            },
          },
          values: { mass_pure: 9, mass_total: 10 },
        },
      ],
    });
  },
);

// --- navigation ----------------------------------------------------------

When(
  "I open the workspace for {string}",
  async function (this: ChemFoxWorld, contextId: string) {
    await this.goto(`/internal/experiment/${contextId}`);
    await this.page
      .getByRole("heading", { name: "Coal proximate analysis" })
      .waitFor({ state: "visible", timeout: 30_000 });
  },
);

When("I try to publish the report", async function (this: ChemFoxWorld) {
  // One click: each click clears the previous error before the action runs.
  const publish = this.page.getByRole("button", { name: "Publish report and close", exact: true });
  await waitForHydration(publish);
  this.page.on("dialog", (dialog) => {
    dialog.accept().catch(() => {});
  }); // publishing asks to confirm (it emails the requester)
  await publish.click();
  await this.page
    .getByText("Could not publish the report.")
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });
});

// --- assertions ----------------------------------------------------------

Then(
  "the calculations should show a result of {string}",
  async function (this: ChemFoxWorld, value: string) {
    const cell = this.page.getByRole("cell", { name: value, exact: true });
    await clickUntil(
      this,
      this.page.getByRole("tab", { name: /Calculations/ }),
      () => cell.isVisible(),
    );
  },
);

Then(
  "experiment-manager stored the result {string} for {string} on {string}",
  function (this: ChemFoxWorld, value: string, key: string, contextId: string) {
    const calcs = findTicket(contextId)?.experiments[0].context.calculations as
      | Record<string, { result: unknown }>
      | undefined;
    assert.equal(JSON.stringify(calcs?.[key]?.result), value);
  },
);

Then("the report panel should be shown", async function (this: ChemFoxWorld) {
  await this.page
    .getByRole("link", { name: "Download PDF", exact: true })
    .waitFor({ state: "visible", timeout: 30_000 });
});

async function expectPdf(world: ChemFoxWorld, path: string) {
  const res = await world.page.request.get(`${runtime.baseUrl}${path}`);
  assert.equal(res.status(), 200, `${path} returned ${res.status()}`);
  assert.match(res.headers()["content-type"] ?? "", /application\/pdf/);
  assert.equal((await res.body()).subarray(0, 5).toString(), "%PDF-");
}

Then(
  "the staff report download for {string} should be a PDF",
  async function (this: ChemFoxWorld, contextId: string) {
    await expectPdf(this, `/internal/experiment/${contextId}/report?download=1`);
  },
);

Then(
  "the requester report download for {string} should be a PDF",
  async function (this: ChemFoxWorld, contextId: string) {
    await expectPdf(this, `/experiment/listing/${contextId}/report?download=1`);
  },
);
