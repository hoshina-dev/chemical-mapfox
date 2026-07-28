import assert from "node:assert/strict";

import { DataTable, Then, When } from "@cucumber/cucumber";

import type { ChemFoxWorld } from "../support/world.js";

When(
  "I search users for {string}",
  async function (this: ChemFoxWorld, query: string) {
    const input = this.page.getByLabel("Search users");
    await input.waitFor({ state: "visible", timeout: 15_000 });
    await input.fill(query);
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
      const row = this.page.getByRole("row").filter({ hasText: email });
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
      // Field label is also rendered; ensure both appear in the panel.
      await detail
        .getByText(field, { exact: true })
        .first()
        .waitFor({ state: "visible", timeout: 15_000 });
    }
  },
);
