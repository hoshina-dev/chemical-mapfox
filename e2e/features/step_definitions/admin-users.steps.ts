import assert from "node:assert/strict";

import { DataTable, Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import type { ChemFoxWorld } from "../support/world.js";

/**
 * Fill the search box until React's controlled value sticks and the
 * "type to search" hint disappears. A single `fill` can race Next hydration
 * in CI (value wiped → searchUsers never fires).
 */
async function searchUntilSettled(
  world: ChemFoxWorld,
  query: string,
  attempts = 25,
): Promise<void> {
  const input = world.page.getByRole("textbox", { name: "Search users" });
  await input.waitFor({ state: "visible", timeout: 15_000 });

  const typeHint = world.page.getByText(
    "Type at least 2 characters to search.",
  );

  for (let i = 0; i < attempts; i += 1) {
    await input.click();
    await input.fill(query);
    if ((await input.inputValue()) !== query) continue;

    try {
      await typeHint.waitFor({ state: "hidden", timeout: 1_000 });
      return;
    } catch {
      // debounce (250ms) / effect not attached yet — retry
    }
  }

  await typeHint.waitFor({ state: "hidden", timeout: 5_000 });
}

When(
  "I search users for {string}",
  async function (this: ChemFoxWorld, query: string) {
    await searchUntilSettled(this, query);
  },
);

When(
  "I select the user {string} from search results",
  async function (this: ChemFoxWorld, email: string) {
    const row = this.page.getByRole("row").filter({ hasText: email });
    await row.first().waitFor({ state: "visible", timeout: 15_000 });
    await row.first().click();
  },
);

Then(
  "the users search results should list:",
  async function (this: ChemFoxWorld, table: DataTable) {
    for (const { name, email, role } of table.hashes()) {
      const row: Locator = this.page
        .getByRole("row")
        .filter({ hasText: email });
      await row.first().waitFor({ state: "visible", timeout: 15_000 });

      const named = await row.filter({ hasText: name }).count();
      assert.ok(named > 0, `expected the row for ${email} to show "${name}"`);

      await row
        .getByText(role, { exact: true })
        .first()
        .waitFor({ state: "visible", timeout: 15_000 });
    }
  },
);

Then(
  "the users search results should be empty",
  async function (this: ChemFoxWorld) {
    await this.page
      .getByText("No users found.", { exact: true })
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

Then(
  "the user detail should show:",
  async function (this: ChemFoxWorld, table: DataTable) {
    const detail = this.page.getByTestId("user-detail");
    await detail.waitFor({ state: "visible", timeout: 15_000 });

    for (const { field, value } of table.hashes()) {
      await detail
        .getByText(value, { exact: true })
        .first()
        .waitFor({ state: "visible", timeout: 15_000 });
      await detail
        .getByText(field, { exact: true })
        .first()
        .waitFor({ state: "visible", timeout: 15_000 });
    }
  },
);
