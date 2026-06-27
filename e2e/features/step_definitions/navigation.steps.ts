import assert from "node:assert/strict";

import { Then, When } from "@cucumber/cucumber";

import type { ChemFoxWorld } from "../support/world.js";

/** Friendly page name → path. */
const PAGES: Record<string, string> = {
  login: "/",
  "my experiments": "/experiment/listing",
  "staff experiments": "/internal/experiment/listing",
  "request catalog": "/experiment/request/listing",
};

async function waitForPath(world: ChemFoxWorld, expected: string): Promise<void> {
  await world.page.waitForURL((url) => new URL(url).pathname === expected, {
    timeout: 30_000,
  });
  assert.equal(world.currentPath(), expected);
}

When("I visit {string}", async function (this: ChemFoxWorld, path: string) {
  await this.goto(path);
});

Then("I should be on the login page", async function (this: ChemFoxWorld) {
  await waitForPath(this, "/");
});

Then(
  "I should be on the {string} page",
  async function (this: ChemFoxWorld, pageName: string) {
    const expected = PAGES[pageName];
    assert.ok(expected, `Unknown page "${pageName}"`);
    await waitForPath(this, expected);
  },
);

Then(
  "I should see the error {string}",
  async function (this: ChemFoxWorld, message: string) {
    await this.page
      .getByRole("alert")
      .filter({ hasText: message })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

Then(
  "I should see the error containing {string}",
  async function (this: ChemFoxWorld, fragment: string) {
    await this.page
      .getByRole("alert")
      .filter({ hasText: new RegExp(fragment, "i") })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);
