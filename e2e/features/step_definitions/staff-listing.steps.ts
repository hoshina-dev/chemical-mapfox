import assert from "node:assert/strict";

import { DataTable, Given, Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import {
  addExperimentRecord,
  addTicket,
} from "../support/stub/modules/staff-listing.js";
import type { ChemFoxWorld } from "../support/world.js";

function searchBox(world: ChemFoxWorld): Locator {
  return world.page.getByLabel("Search experiments");
}

/** The toolbar div that holds the search box + the status filter pills. */
function toolbar(world: ChemFoxWorld): Locator {
  return searchBox(world).locator("xpath=..");
}

function rows(world: ChemFoxWorld): Locator {
  return world.page.locator("tbody tr");
}

function rowFor(world: ChemFoxWorld, name: string): Locator {
  return rows(world).filter({ hasText: name });
}

/**
 * The listing is a client component, so its controls are inert until React
 * hydrates (a `next dev` race). Probe with a search term that matches nothing
 * and wait for every row to disappear, then clear it — proving the search
 * input is wired up before we drive it.
 */
async function ensureListingReady(world: ChemFoxWorld): Promise<void> {
  const search = searchBox(world);
  await search.waitFor({ state: "visible", timeout: 30_000 });
  await world.page.waitForLoadState("networkidle").catch(() => {});
  const probe = "zzz-not-a-real-experiment-zzz";
  for (let i = 0; i < 40; i += 1) {
    await search.fill(probe);
    try {
      await world.page.waitForFunction(
        () => document.querySelectorAll("tbody tr").length === 0,
        undefined,
        { timeout: 1200 },
      );
      await search.fill("");
      return;
    } catch {
      // not hydrated yet — retry
    }
  }
  throw new Error("staff experiment listing never became interactive");
}

// --- data setup ----------------------------------------------------------

Given(
  "the following experiment tickets exist:",
  function (this: ChemFoxWorld, table: DataTable) {
    for (const row of table.hashes()) {
      addTicket({
        id: row.id || undefined,
        name: row.name,
        status: row.status,
        requesterEmail: row.requester || undefined,
        createdAt: row.createdAt || undefined,
        updatedAt: row.updatedAt || undefined,
      });
    }
  },
);

Given(
  "an experiment record exists for {string} with analyst {string}",
  function (this: ChemFoxWorld, contextId: string, analyst: string) {
    addExperimentRecord(contextId, {
      id: contextId,
      status: "experimenting",
      values: { analyst },
    });
  },
);

// --- interactions --------------------------------------------------------

When(
  "I search the experiments for {string}",
  async function (this: ChemFoxWorld, query: string) {
    await ensureListingReady(this);
    await searchBox(this).fill(query);
  },
);

When(
  "I filter experiments by status {string}",
  async function (this: ChemFoxWorld, label: string) {
    await ensureListingReady(this);
    await toolbar(this)
      .getByRole("button", { name: label, exact: true })
      .click();
  },
);

When(
  "I sort the experiments by {string}",
  async function (this: ChemFoxWorld, column: string) {
    await ensureListingReady(this);
    await this.page
      .getByRole("columnheader", { name: new RegExp(`^${column}`) })
      .click();
  },
);

When(
  "I open the raw view for {string}",
  async function (this: ChemFoxWorld, contextId: string) {
    await this.goto(`/internal/experiment/${contextId}/raw`);
  },
);

// --- assertions ----------------------------------------------------------

Then(
  "I should see the experiment {string}",
  async function (this: ChemFoxWorld, name: string) {
    await rowFor(this, name)
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

Then(
  "I should not see the experiment {string}",
  async function (this: ChemFoxWorld, name: string) {
    await rowFor(this, name)
      .first()
      .waitFor({ state: "hidden", timeout: 15_000 });
  },
);

Then(
  "I should see {int} experiments in the listing",
  async function (this: ChemFoxWorld, count: number) {
    await this.page.waitForFunction(
      (expected) => document.querySelectorAll("tbody tr").length === expected,
      count,
      { timeout: 15_000 },
    );
  },
);

Then(
  "the experiment {string} should show requester {string}",
  async function (this: ChemFoxWorld, name: string, requester: string) {
    await rowFor(this, name)
      .first()
      .getByText(requester, { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

Then(
  "the experiments should appear in this order:",
  async function (this: ChemFoxWorld, table: DataTable) {
    const expected = table.hashes().map((row) => row.experiment);
    await this.page.waitForFunction(
      (names) => {
        const cells = Array.from(
          document.querySelectorAll("tbody tr td:first-child"),
        );
        const got = cells.map((c) => (c.textContent ?? "").trim());
        return (
          got.length === names.length &&
          names.every((n, i) => (got[i] ?? "").includes(n))
        );
      },
      expected,
      { timeout: 15_000 },
    );
  },
);

async function rawCardText(
  world: ChemFoxWorld,
  header: string,
): Promise<string> {
  const pre = world.page
    .getByText(header, { exact: true })
    .locator("xpath=following::pre[1]");
  await pre.waitFor({ state: "visible", timeout: 15_000 });
  return pre.innerText();
}

Then(
  "the raw ticket JSON should contain {string}",
  async function (this: ChemFoxWorld, value: string) {
    const text = await rawCardText(this, "Ticket (ticketing-service)");
    assert.ok(
      text.includes(value),
      `ticket JSON should contain "${value}"\n--- got ---\n${text}`,
    );
  },
);

Then(
  "the raw experiment JSON should contain {string}",
  async function (this: ChemFoxWorld, value: string) {
    const text = await rawCardText(this, "Experiment (experiment-manager)");
    assert.ok(
      text.includes(value),
      `experiment JSON should contain "${value}"\n--- got ---\n${text}`,
    );
  },
);
