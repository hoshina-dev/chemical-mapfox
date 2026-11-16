import { DataTable, Given, Then } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import { seedTicketFor, toStatus } from "../support/tickets.js";
import type { ChemFoxWorld } from "../support/world.js";

// Distinct timestamps keep the newest-first ordering deterministic.
let seq = 0;

// --- data setup ----------------------------------------------------------

Given(
  "the following experiments exist for {string}:",
  function (this: ChemFoxWorld, email: string, table: DataTable) {
    for (const row of table.hashes()) {
      seq += 1;
      seedTicketFor(email, {
        id: row.contextId?.trim() || undefined,
        name: row.name.trim(),
        stage: toStatus(row.status),
        updatedAt: new Date(Date.UTC(2025, 0, 1, 1, 0, seq)).toISOString(),
      });
    }
  },
);

// --- assertions ----------------------------------------------------------

Then(
  "I should see {string}",
  async function (this: ChemFoxWorld, text: string) {
    await this.page
      .getByText(text, { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

/**
 * Locate a Kanban lane column by its header label. A lane is a Mantine `Paper`
 * whose header `Text` equals the label; the experiment cards inside it carry a
 * status `Badge` with the same label, so filtering by that exact text matches
 * both the column and its card(s) — the column is the DOM ancestor, hence
 * `.first()`.
 */
function laneColumn(world: ChemFoxWorld, label: string): Locator {
  return world.page
    .locator(".mantine-Paper-root")
    .filter({ has: world.page.getByText(label, { exact: true }) })
    .first();
}

Then(
  "the {string} lane should contain {string}",
  async function (this: ChemFoxWorld, lane: string, experiment: string) {
    await laneColumn(this, lane)
      .getByText(experiment, { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);
