import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import {
  findSampleByName,
  seedTemplate,
} from "../support/stub/modules/template-authoring.js";
import type { ChemFoxWorld } from "../support/world.js";

const ONBOARDING = "/internal/experiment/onboarding";

/** Per-scenario scratch space (the title last typed into the builder). */
type AuthoringWorld = ChemFoxWorld & { lastTitle?: string };

function samplePath(sampleId: string): string {
  return `${ONBOARDING}/${sampleId}`;
}

function sampleId(world: ChemFoxWorld, name: string): string {
  const sample = findSampleByName(name);
  assert.ok(sample, `sample "${name}" was not seeded`);
  return sample.id;
}

/**
 * In dev mode React hydration can lag a freshly navigated page, so a click on
 * a hydration-only control (a Mantine button/row whose handler isn't attached
 * yet) is a silent no-op. Re-click until `done()` reports success.
 */
async function clickUntil(
  world: ChemFoxWorld,
  trigger: Locator,
  done: () => Promise<boolean>,
  attempts = 30,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    await trigger.click({ timeout: 5000 }).catch(() => {});
    if (await done().catch(() => false)) return;
    await world.page.waitForTimeout(400);
  }
  assert.ok(await done(), "clickUntil: condition never became true");
}

/**
 * Fill a (controlled, Mantine) input and confirm the value stuck. A fill that
 * lands before hydration completes gets reset to the form's initial value, so
 * re-fill until the DOM value matches what we want.
 */
async function setInput(
  world: ChemFoxWorld,
  input: Locator,
  value: string,
): Promise<void> {
  await input.waitFor({ state: "visible", timeout: 15_000 });
  for (let i = 0; i < 20; i += 1) {
    await input.fill(value).catch(() => {});
    if ((await input.inputValue().catch(() => "")) === value) return;
    await world.page.waitForTimeout(250);
  }
  await input.fill(value);
}

function metaNameInput(world: ChemFoxWorld): Locator {
  // Mantine renders the required marker into the label text ("Name *"), so
  // anchor a regex at the start to avoid matching "Section name *".
  return world.page.getByLabel(/^Name\b/).first();
}

function isOnBuilderPath(world: ChemFoxWorld): boolean {
  return /^\/internal\/experiment\/onboarding\/[^/]+\/[^/]+$/.test(
    world.currentPath(),
  );
}

// --- data setup ----------------------------------------------------------

Given(
  "the sample {string} has an experiment template {string}",
  function (this: ChemFoxWorld, sampleName: string, templateName: string) {
    seedTemplate(sampleName, templateName);
  },
);

// --- samples -------------------------------------------------------------

When(
  "I register a sample named {string}",
  async function (this: ChemFoxWorld, name: string) {
    const nameField = this.page.getByPlaceholder("e.g. Coal");
    await clickUntil(
      this,
      this.page.getByRole("button", { name: "Register sample" }),
      () => nameField.isVisible(),
    );
    await setInput(this, nameField, name);
    await clickUntil(
      this,
      this.page.getByRole("button", { name: "Create", exact: true }),
      async () =>
        /^\/internal\/experiment\/onboarding\/[^/]+$/.test(this.currentPath()),
    );
  },
);

Then(
  "the sample {string} should appear in the samples list",
  async function (this: ChemFoxWorld, name: string) {
    await this.goto(ONBOARDING);
    await this.page
      .getByText(name, { exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

When(
  "I open the sample {string}",
  async function (this: ChemFoxWorld, name: string) {
    const path = samplePath(sampleId(this, name));
    await this.page.locator(`a[href="${path}"]`).first().click();
    await this.page.waitForURL(
      (url) => new URL(url).pathname === path,
      { timeout: 30_000 },
    );
  },
);

// --- templates -----------------------------------------------------------

Then(
  "I should see the experiment template {string}",
  async function (this: ChemFoxWorld, title: string) {
    await this.page
      .getByText(title, { exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

When("I start a new template", async function (this: ChemFoxWorld) {
  await this.page.getByRole("link", { name: "New template" }).first().click();
  await this.page.waitForURL((url) => new URL(url).pathname.endsWith("/new"), {
    timeout: 30_000,
  });
  await metaNameInput(this).waitFor({ state: "visible", timeout: 30_000 });
});

When(
  "I name the template {string}",
  async function (this: AuthoringWorld, title: string) {
    await setInput(this, metaNameInput(this), title);
    this.lastTitle = title;
  },
);

When(
  "I rename the template to {string}",
  async function (this: AuthoringWorld, title: string) {
    await setInput(this, metaNameInput(this), title);
    this.lastTitle = title;
  },
);

When(
  "I add a short-text question with id {string} labelled {string}",
  async function (this: ChemFoxWorld, id: string, label: string) {
    const idField = this.page.getByPlaceholder("snake_case identifier");
    await clickUntil(
      this,
      this.page.getByRole("button", { name: "Add question" }).first(),
      () => idField.isVisible(),
    );
    await setInput(this, idField, id);
    await setInput(this, this.page.getByLabel(/^Label\b/).first(), label);
  },
);

When("I save the template", async function (this: AuthoringWorld) {
  const title = this.lastTitle;
  assert.ok(title, "no template title was set before saving");
  const saveButton = this.page.getByRole("button", {
    name: /^(Create template|Save changes)$/,
  });
  const heading = this.page.getByRole("heading", { name: `Edit: ${title}` });
  await clickUntil(this, saveButton, () => heading.isVisible());
});

Then(
  "the template {string} should be saved",
  async function (this: ChemFoxWorld, title: string) {
    await this.page
      .getByRole("heading", { name: `Edit: ${title}` })
      .waitFor({ state: "visible", timeout: 15_000 });
    assert.ok(
      isOnBuilderPath(this),
      `expected to be on a template builder page, got ${this.currentPath()}`,
    );
  },
);

When(
  "I open the experiment template {string}",
  async function (this: ChemFoxWorld, title: string) {
    const row = this.page.getByText(title, { exact: true });
    await clickUntil(this, row, async () => isOnBuilderPath(this));
  },
);

When("I delete the template", async function (this: ChemFoxWorld) {
  this.page.on("dialog", (dialog) => {
    dialog.accept().catch(() => {});
  });
  await clickUntil(
    this,
    this.page.getByRole("button", { name: "Delete", exact: true }),
    async () => this.currentPath() === ONBOARDING,
  );
});

// --- assertions ----------------------------------------------------------

Then(
  "I should be on the experiment onboarding page",
  async function (this: ChemFoxWorld) {
    await this.page.waitForURL(
      (url) => new URL(url).pathname === ONBOARDING,
      { timeout: 30_000 },
    );
  },
);

Then(
  "the sample {string} should have no experiment template {string}",
  async function (this: ChemFoxWorld, name: string, title: string) {
    const path = samplePath(sampleId(this, name));
    await this.goto(path);
    await this.page
      .getByRole("link", { name: "New template" })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
    assert.equal(
      await this.page.getByText(title, { exact: true }).count(),
      0,
      `template "${title}" should no longer be listed`,
    );
  },
);
