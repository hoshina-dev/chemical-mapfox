import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import {
  findTicket,
  sampleTracker,
  seedSampleType,
  seedTemplate,
} from "../support/stub/modules/sample-tracker.js";
import type { ChemFoxWorld } from "../support/world.js";

/**
 * Click `trigger` until `reveals` becomes visible. In dev mode React hydration
 * can lag a freshly navigated page, so a click on an interactive-only control
 * (a Mantine accordion control, …) is a no-op until its handler is attached.
 * Retrying the click absorbs that race. (Mirrors the auth steps' helper.)
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

// --- data setup ----------------------------------------------------------

Given(
  "the catalog offers a sample {string} with experiment {string}",
  function (this: ChemFoxWorld, sampleName: string, templateTitle: string) {
    seedSampleType(sampleName, {
      description: `${sampleName} specimens accepted by the lab.`,
    });
    seedTemplate(sampleName, templateTitle, {
      description: `${templateTitle} run on a ${sampleName} specimen.`,
      body: {
        clientForm: {
          name: "Client intake",
          questions: [
            { id: "sample_summary", type: "string", label: "Sample description", required: true },
          ],
        },
      },
    });
  },
);

// --- catalogue browsing --------------------------------------------------

Then(
  "I should see the specimen {string}",
  async function (this: ChemFoxWorld, sampleName: string) {
    await this.page
      .getByText(sampleName, { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

When(
  "I expand the {string} specimen",
  async function (this: ChemFoxWorld, sampleName: string) {
    const control = this.page
      .getByRole("button")
      .filter({ hasText: sampleName });
    await clickUntilVisible(
      control.first(),
      this.page.getByText("Tick the methods to run on your sample.").first(),
    );
  },
);

Then(
  "I should see the experiment {string} in the catalogue",
  async function (this: ChemFoxWorld, templateTitle: string) {
    await this.page
      .getByText(templateTitle, { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

// --- intake flow ---------------------------------------------------------

When(
  "I request the experiment {string}",
  async function (this: ChemFoxWorld, templateTitle: string) {
    await this.page.getByRole("checkbox", { name: templateTitle }).first().check();
    await this.page.getByRole("link", { name: "Request 1", exact: true }).click();
  },
);

Then(
  "I should be on the request form for {string}",
  async function (this: ChemFoxWorld, templateTitle: string) {
    await this.page.waitForURL(
      (url) =>
        /^\/experiment\/request\/(?!listing(?:\/|$))[^/]+$/.test(
          new URL(url).pathname,
        ),
      { timeout: 30_000 },
    );
    await this.page
      .getByText(templateTitle, { exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

When(
  "I fill in the {string} field with {string}",
  async function (this: ChemFoxWorld, label: string, value: string) {
    const field = this.page.getByLabel(label).first();
    await field.waitFor({ state: "visible", timeout: 15_000 });
    await field.fill(value);
  },
);

When("I submit the request", async function (this: ChemFoxWorld) {
  await this.page
    .getByRole("button", { name: "Submit request" })
    .first()
    .click();
});

Then(
  "I should land on my experiment workspace",
  async function (this: ChemFoxWorld) {
    await this.page.waitForURL(
      (url) => /^\/experiment\/listing\/[^/]+$/.test(new URL(url).pathname),
      { timeout: 30_000 },
    );
    assert.match(this.currentPath(), /^\/experiment\/listing\/[^/]+$/);
  },
);

Then(
  "the lab receives my request for {string} with {string}",
  function (this: ChemFoxWorld, templateTitle: string, answer: string) {
    const id = this.currentPath().split("/").at(-1) ?? "";
    const ticket = findTicket(id);
    assert.ok(ticket, `sample_tracker has no ticket ${id} (${sampleTracker.tickets.length} tickets)`);
    assert.equal(ticket.experiments.length, 1);
    assert.equal(ticket.experiments[0].templateName, templateTitle);
    assert.deepEqual(ticket.experiments[0].context.values, { sample_summary: answer });
  },
);
