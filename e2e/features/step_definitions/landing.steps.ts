import assert from "node:assert/strict";

import { Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import type { ChemFoxWorld } from "../support/world.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function offerSection(world: ChemFoxWorld): Locator {
  return world.page.locator("#offer");
}

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

Then("I should be on the landing page", async function (this: ChemFoxWorld) {
  await this.page.waitForURL((url) => new URL(url).pathname === "/", {
    timeout: 30_000,
  });
  assert.equal(this.currentPath(), "/");
});

Then("I should see the landing hero", async function (this: ChemFoxWorld) {
  await this.page
    .getByRole("heading", {
      name: "Chemical experiments, from request to certified results.",
      level: 1,
    })
    .waitFor({ state: "visible", timeout: 15_000 });
});

Then(
  "I should see the primary navigation link {string}",
  async function (this: ChemFoxWorld, label: string) {
    await this.page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: label, exact: true })
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

Then(
  "I should see the {string} call to action",
  async function (this: ChemFoxWorld, label: string) {
    await this.page
      .getByRole("link", { name: label, exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

When(
  "I click the {string} call to action",
  async function (this: ChemFoxWorld, label: string) {
    await this.page
      .getByRole("link", { name: label, exact: true })
      .first()
      .click();
  },
);

Then(
  "I should see the {string} button",
  async function (this: ChemFoxWorld, label: string) {
    await this.page
      .getByRole("button", { name: label, exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

When(
  "I click the {string} button",
  async function (this: ChemFoxWorld, label: string) {
    await this.page
      .getByRole("button", { name: label, exact: true })
      .first()
      .click();
  },
);

When(
  "I click the {string} link",
  async function (this: ChemFoxWorld, label: string) {
    await this.page
      .getByRole("link", { name: label, exact: true })
      .first()
      .click();
  },
);

Then(
  "I should not see the {string} link",
  async function (this: ChemFoxWorld, label: string) {
    await this.page
      .getByRole("link", { name: label, exact: true })
      .waitFor({ state: "hidden", timeout: 15_000 });
  },
);

Then(
  "I should see the specimen {string} in the laboratory offer",
  async function (this: ChemFoxWorld, sampleName: string) {
    await offerSection(this)
      .getByText(sampleName, { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

When(
  "I expand the {string} specimen in the laboratory offer",
  async function (this: ChemFoxWorld, sampleName: string) {
    const control = offerSection(this)
      .getByRole("button")
      .filter({ hasText: sampleName });
    await clickUntilVisible(
      control.first(),
      offerSection(this).getByRole("link", {
        name: "Request this experiment",
        exact: true,
      }),
    );
  },
);

Then(
  "I should see the experiment {string} in the laboratory offer",
  async function (this: ChemFoxWorld, experimentName: string) {
    await offerSection(this)
      .getByText(new RegExp(escapeRegExp(experimentName)))
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);
