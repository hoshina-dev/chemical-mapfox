import { Then } from "@cucumber/cucumber";

import type { ChemFoxWorld } from "../support/world.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

Then(
  "I should see the {string} heading",
  async function (this: ChemFoxWorld, name: string) {
    await this.page
      .getByRole("heading", { name, exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

Then(
  "the component reference should list {string}",
  async function (this: ChemFoxWorld, label: string) {
    await this.page
      .getByRole("link", { name: new RegExp(escapeRegExp(label)) })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

Then(
  "the live preview should render the field labelled {string}",
  async function (this: ChemFoxWorld, label: string) {
    await this.page
      .getByLabel(new RegExp(escapeRegExp(label)))
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

Then(
  "the schema fields should document the {string} field",
  async function (this: ChemFoxWorld, field: string) {
    await this.page
      .getByRole("cell", { name: field, exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);
