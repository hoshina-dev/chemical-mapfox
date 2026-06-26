import { DataTable, Given, Then } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import { findUserByEmail } from "../support/fixtures.js";
import { addTicket } from "../support/stub/modules/client-tracking.js";
import type { ChemFoxWorld } from "../support/world.js";

// Monotonic counter so seeded tickets get distinct ids/timestamps when a
// scenario doesn't pin a `contextId`. Tickets are reset per scenario in the
// stub module, so this only needs to stay unique, not reset.
let seq = 0;

// --- data setup ----------------------------------------------------------

Given(
  "the following experiments exist for {string}:",
  function (this: ChemFoxWorld, email: string, table: DataTable) {
    const owner = findUserByEmail(email);
    if (!owner) {
      throw new Error(`no fixture user exists for email "${email}"`);
    }
    for (const row of table.hashes()) {
      seq += 1;
      addTicket({
        id: row.contextId?.trim() || `exp-${seq}`,
        name: row.name?.trim() || null,
        status: (row.status?.trim() || "REQUESTED").toUpperCase(),
        userId: owner.id,
        // Stagger timestamps so the newest-first ordering is deterministic.
        updatedAt: new Date(
          Date.UTC(2025, 0, 1, 0, 0, seq),
        ).toISOString(),
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
