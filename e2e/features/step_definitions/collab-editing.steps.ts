import assert from "node:assert/strict";

import { After, Given, Then, When } from "@cucumber/cucumber";
import type { BrowserContext, Locator, Page } from "playwright";

import { addUser } from "../support/fixtures.js";
import { findTicket, sampleTracker } from "../support/stub/modules/sample-tracker.js";
import { seedTicketFor, toStatus } from "../support/tickets.js";
import type { ChemFoxWorld } from "../support/world.js";

/**
 * World extended with the per-scenario collab state this feature needs: the
 * generated experiment context id, and (for the multi-staff scenario) a second
 * browser context/page acting as a different technician. Kept local to this
 * file — `world.ts`/`hooks.ts` are shared and must not be modified.
 */
interface CollabWorld extends ChemFoxWorld {
  collabContextId?: string;
  secondContext?: BrowserContext;
  secondPage?: Page;
}

const WORKSPACE = (contextId: string) =>
  `/internal/experiment/${contextId}`;

/** The single lab-form question this feature exercises. */
const LAB_FIELD_ID = "observations";
const LAB_FIELD_LABEL = "Observations";

const storedValues = (contextId: string) =>
  (findTicket(contextId)?.experiments[0].context.values ?? {}) as Record<string, unknown>;

/** Values saves sample_tracker received for the ticket (the collab autosave). */
const saveCount = (contextId: string) =>
  sampleTracker.writes.filter(
    (w) => w.path.startsWith(`tickets/${contextId}/`) && w.path.endsWith("/values"),
  ).length;

/** Poll an async predicate until it returns true or the timeout elapses. */
async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  { timeout = 15_000, interval = 250 }: { timeout?: number; interval?: number } = {},
): Promise<boolean> {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, interval));
  }
}

function contextIdOf(world: CollabWorld): string {
  assert.ok(world.collabContextId, "no experiment was seeded for this scenario");
  return world.collabContextId;
}

/** The editable collaborative input for the single lab field, on a given page. */
function labFieldInput(page: Page): Locator {
  return page.locator(`[data-field="${LAB_FIELD_ID}"] input`);
}

/** Sign in on an arbitrary page (used for the second technician's context). */
async function signInOnPage(
  page: Page,
  baseUrl: string,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  const form = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Sign in" }) });
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="password"]').fill(password);
  await form.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => new URL(url).pathname !== "/login", {
    timeout: 30_000,
  });
}

// --- setup ----------------------------------------------------------------

Given(
  "an experiment with ticket status {string}",
  function (this: CollabWorld, status: string) {
    // A fresh context id per scenario keeps the (shared, real) Redis room
    // isolated across scenarios and reruns.
    const contextId = `collab-${crypto.randomUUID()}`;
    this.collabContextId = contextId;
    seedTicketFor(undefined, {
      id: contextId,
      name: "Collaborative water analysis",
      stage: toStatus(status),
      methods: [
        {
          name: "Water analysis",
          body: {
            labForm: {
              name: "Lab worksheet",
              questions: [{ id: LAB_FIELD_ID, type: "string", label: LAB_FIELD_LABEL }],
            },
          },
        },
      ],
    });
  },
);

Given(
  "a second technician exists with email {string} and password {string}",
  function (this: CollabWorld, email: string, password: string) {
    addUser({ name: "Tara Tech", email, password, role: "admin" });
  },
);

// --- navigation -----------------------------------------------------------

When("I open the experiment workspace", async function (this: CollabWorld) {
  await this.goto(WORKSPACE(contextIdOf(this)));
});

When("I reopen the experiment workspace", async function (this: CollabWorld) {
  await this.goto(WORKSPACE(contextIdOf(this)));
});

When(
  "a second technician opens the experiment as {string} with password {string}",
  async function (this: CollabWorld, email: string, password: string) {
    const browser = this.context.browser();
    assert.ok(browser, "shared browser is unavailable");
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    this.secondContext = ctx;
    this.secondPage = page;
    await signInOnPage(page, this.baseUrl, email, password);
    await page.goto(`${this.baseUrl}${WORKSPACE(contextIdOf(this))}`, {
      waitUntil: "domcontentloaded",
    });
  },
);

// --- editing --------------------------------------------------------------

When(
  "I enter {string} in the lab form",
  async function (this: CollabWorld, value: string) {
    const input = labFieldInput(this.page);
    await input.waitFor({ state: "visible", timeout: 30_000 });
    await input.fill(value);
    // Let the throttled edit POST go out, then blur to release the field and
    // trigger a prompt autosave flush (the debounce backs this up regardless).
    await this.page.waitForTimeout(500);
    await input.blur();
  },
);

When("I focus the lab form", async function (this: CollabWorld) {
  const input = labFieldInput(this.page);
  await input.waitFor({ state: "visible", timeout: 30_000 });
  await input.focus();
});

When(
  "I type {string} in the lab form",
  async function (this: CollabWorld, value: string) {
    const input = labFieldInput(this.page);
    await input.waitFor({ state: "visible", timeout: 30_000 });
    // Keep focus (don't blur) so the soft lock stays held while editing.
    await input.fill(value);
  },
);

// --- assertions -----------------------------------------------------------

Then(
  "the experiment is autosaved with {string}",
  async function (this: CollabWorld, value: string) {
    const contextId = contextIdOf(this);
    const ok = await waitFor(
      () => saveCount(contextId) >= 1 && storedValues(contextId)[LAB_FIELD_ID] === value,
      { timeout: 15_000 },
    );
    assert.ok(
      ok,
      `expected sample_tracker to store "${value}"; ` +
        `saw saves=${saveCount(contextId)}, ` +
        `value=${JSON.stringify(storedValues(contextId)[LAB_FIELD_ID])}`,
    );
  },
);

Then(
  "the lab form shows {string}",
  async function (this: CollabWorld, value: string) {
    const input = labFieldInput(this.page);
    await input.waitFor({ state: "visible", timeout: 30_000 });
    const ok = await waitFor(async () => (await input.inputValue()) === value, {
      timeout: 15_000,
    });
    assert.ok(ok, `lab field never showed "${value}"`);
  },
);

Then("I should see the start-experiment gate", async function (this: CollabWorld) {
  await this.page
    .getByRole("button", { name: "Start experiment" })
    .waitFor({ state: "visible", timeout: 30_000 });
});

Then("the lab form is read-only", async function (this: CollabWorld) {
  const field = this.page.getByLabel(LAB_FIELD_LABEL);
  await field.waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(
    await field.isDisabled(),
    true,
    "expected the lab field to be read-only (disabled)",
  );
  // It must not be the editable collaborative editor.
  assert.equal(
    await this.page.locator(`[data-field="${LAB_FIELD_ID}"]`).count(),
    0,
    "expected no collaborative editor before the experiment is started",
  );
});

function secondPage(world: CollabWorld): Page {
  assert.ok(world.secondPage, "the second technician has not opened the page");
  return world.secondPage;
}

Then(
  "the second technician sees another editor present",
  async function (this: CollabWorld) {
    const page = secondPage(this);
    await page
      .getByText("Editing now:")
      .waitFor({ state: "visible", timeout: 30_000 });
  },
);

Then(
  "the second technician sees the lab field locked",
  async function (this: CollabWorld) {
    const page = secondPage(this);
    await page
      .locator(`[data-field="${LAB_FIELD_ID}"][data-locked="true"]`)
      .waitFor({ state: "visible", timeout: 30_000 });
  },
);

Then(
  "the second technician sees {string} in the lab field",
  async function (this: CollabWorld, value: string) {
    const input = labFieldInput(secondPage(this));
    const ok = await waitFor(async () => (await input.inputValue()) === value, {
      timeout: 30_000,
    });
    assert.ok(ok, `second technician never saw "${value}" propagate`);
  },
);

// --- cleanup --------------------------------------------------------------

After(async function (this: CollabWorld) {
  await this.secondPage?.close().catch(() => {});
  await this.secondContext?.close().catch(() => {});
  this.secondPage = undefined;
  this.secondContext = undefined;
  this.collabContextId = undefined;
});
