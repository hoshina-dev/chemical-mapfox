import assert from "node:assert/strict";

import { DataTable, Then } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import type { ChemFoxWorld } from "../support/world.js";

/**
 * The two headline cards (`/admin/users`) each pair a dimmed label with an
 * `<h2>` count. Scope to the only cards that contain a level-2 heading, then
 * pick the one whose label matches — avoids the ambiguity of the word "Users"
 * also appearing as the page title and the table-section heading.
 */
function countCard(world: ChemFoxWorld, label: string): Locator {
  return world.page
    .locator(".mantine-Card-root")
    .filter({ has: world.page.getByRole("heading", { level: 2 }) })
    .filter({ hasText: label });
}

Then(
  "the {string} count should show {string}",
  async function (this: ChemFoxWorld, label: string, expected: string) {
    const heading = countCard(this, label)
      .getByRole("heading", { level: 2 })
      .first();
    await heading.waitFor({ state: "visible", timeout: 15_000 });
    assert.equal((await heading.textContent())?.trim(), expected);
  },
);

Then(
  "the users table should list:",
  async function (this: ChemFoxWorld, table: DataTable) {
    for (const { name, email, role } of table.hashes()) {
      const row = this.page.getByRole("row").filter({ hasText: email });
      await row.first().waitFor({ state: "visible", timeout: 15_000 });

      const named = await row.filter({ hasText: name }).count();
      assert.ok(named > 0, `expected the row for ${email} to show "${name}"`);

      // The role renders as a Mantine Badge whose only text is the role itself.
      await row
        .getByText(role, { exact: true })
        .first()
        .waitFor({ state: "visible", timeout: 15_000 });
    }
  },
);

Then(
  "the organizations list should include:",
  async function (this: ChemFoxWorld, table: DataTable) {
    for (const { name } of table.hashes()) {
      await this.page
        .getByText(name, { exact: true })
        .first()
        .waitFor({ state: "visible", timeout: 15_000 });
    }
  },
);
