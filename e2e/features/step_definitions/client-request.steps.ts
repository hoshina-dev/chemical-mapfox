import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import { createUserFromRegistration } from "../support/fixtures.js";
import { seedCatalogTemplate } from "../support/stub/modules/client-request.js";
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
    seedCatalogTemplate({
      sampleName,
      sampleDescription: `${sampleName} specimens accepted by the lab.`,
      templateTitle,
      templateDescription: `${templateTitle} run on a ${sampleName} specimen.`,
    });
  },
);

Given(
  "a client {string} with password {string} who belongs to no organization",
  function (this: ChemFoxWorld, email: string, password: string) {
    createUserFromRegistration({
      name: "Unaffiliated Client",
      email,
      password,
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
    // `exact` keeps this off the navbar's "Request experiment" link.
    await clickUntilVisible(
      control.first(),
      this.page.getByRole("link", { name: "Request", exact: true }).first(),
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
    // The catalogue seeds a single current template per specimen, so the one
    // exact "Request" link (not the navbar's "Request experiment") is the one
    // for `templateTitle`.
    void templateTitle;
    await this.page
      .getByRole("link", { name: "Request", exact: true })
      .first()
      .click();
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
      .getByRole("heading", { name: templateTitle })
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
