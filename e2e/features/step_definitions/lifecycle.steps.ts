import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import {
  failNextWrite,
  findTicket,
  ticketStatus,
} from "../support/stub/modules/experiment-manager.js";
import { seedTicketFor, toStatus } from "../support/tickets.js";
import type { ChemFoxWorld } from "../support/world.js";

const workspacePath = (contextId: string) =>
  `/internal/experiment/${contextId}`;

function button(world: ChemFoxWorld, name: string): Locator {
  return world.page.getByRole("button", { name, exact: true });
}

async function visible(locator: Locator): Promise<boolean> {
  return locator
    .first()
    .isVisible()
    .catch(() => false);
}

function status(contextId: string) {
  const ticket = findTicket(contextId);
  assert.ok(ticket, `no ticket "${contextId}"`);
  return ticketStatus(ticket);
}

/**
 * Click `target` until `done()` reports the action landed. React hydration can
 * lag a freshly navigated dev page, so an early click is a no-op until the
 * handler attaches — retrying absorbs that race. A Mantine button in its
 * loading state sets `pointer-events: none`, so retries during an in-flight
 * action are harmless no-ops (never a double submit).
 */
async function clickUntil(
  world: ChemFoxWorld,
  target: Locator,
  done: () => Promise<boolean>,
  attempts = 60,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (await done()) return;
    await target.click({ timeout: 1000 }).catch(() => {});
    await world.page.waitForTimeout(300);
  }
  for (let i = 0; i < 120; i += 1) {
    if (await done()) return;
    await world.page.waitForTimeout(300);
  }
  assert.fail("the action did not complete in time");
}

// --- data setup ----------------------------------------------------------

Given(
  "an experiment {string} is at the {string} stage",
  function (this: ChemFoxWorld, contextId: string, stage: string) {
    seedTicketFor(undefined, {
      id: contextId,
      name: `Experiment ${contextId}`,
      stage: toStatus(stage),
    });
  },
);

When(
  "another technician starts experiment {string} meanwhile",
  function (this: ChemFoxWorld, contextId: string) {
    const ticket = findTicket(contextId);
    assert.ok(ticket, `no ticket "${contextId}"`);
    ticket.experiments[0].startedAt = new Date().toISOString();
  },
);

Given(
  "experiment-manager finds ticket {string} busy on the next command",
  function (this: ChemFoxWorld, contextId: string) {
    // What a lock timeout returns (apperr.MapError): 409, nothing changed.
    failNextWrite({ pathIncludes: `tickets/${contextId}/` }, 409, "the ticket is busy; try again");
  },
);

// --- lifecycle actions ---------------------------------------------------

When(
  "I check in the sample for {string}",
  async function (this: ChemFoxWorld, contextId: string) {
    await clickUntil(this, button(this, "Check in sample"), async () =>
      status(contextId) === "RECEIVED",
    );
  },
);

When(
  "I start the experiment {string}",
  async function (this: ChemFoxWorld, contextId: string) {
    await clickUntil(this, button(this, "Start experiment"), async () =>
      status(contextId) === "IN_PROGRESS",
    );
  },
);

When(
  "I try to start the experiment {string}",
  async function (this: ChemFoxWorld, _contextId: string) {
    await button(this, "Start experiment").waitFor({ state: "visible", timeout: 30_000 });
    await clickUntil(this, button(this, "Start experiment"), async () =>
      visible(this.page.getByText("Could not start experiment", { exact: true })),
    );
  },
);

// After a refused start the page may refresh (when the action response renews the
// session cookie), replacing the button and its error with the editor; either shows
// the method as started.
const startedByOther = (world: ChemFoxWorld) => async () =>
  (await visible(world.page.getByRole("alert").filter({ hasText: "experiment is already started" }))) ||
  (await visible(button(world, "Finish experiment")));

When("I click Start experiment", async function (this: ChemFoxWorld) {
  await button(this, "Start experiment").waitFor({ state: "visible", timeout: 30_000 });
  await clickUntil(this, button(this, "Start experiment"), startedByOther(this));
});

Then(
  "the workspace shows the method as already started",
  async function (this: ChemFoxWorld) {
    assert.ok(await startedByOther(this)(), "neither the refusal nor the editor is shown");
  },
);

When(
  "I finish the experiment {string}",
  async function (this: ChemFoxWorld, contextId: string) {
    // Finishing calculates in the browser (Pyodide) first; allow for its download.
    await clickUntil(
      this,
      button(this, "Finish experiment"),
      async () => findTicket(contextId)?.experiments.every((e) => e.finishedAt) ?? false,
    );
  },
);

When(
  "I publish the report for {string}",
  async function (this: ChemFoxWorld, contextId: string) {
    // Publishing emails the requester, so the page asks to confirm.
    this.page.on("dialog", (dialog) => {
      dialog.accept().catch(() => {});
    });
    await clickUntil(this, button(this, "Publish report"), async () =>
      Boolean(findTicket(contextId)?.events.some((e) => e.type === "ticket.report_published")),
    );
  },
);

When(
  "I close the ticket {string}",
  async function (this: ChemFoxWorld, contextId: string) {
    await clickUntil(this, button(this, "Close ticket"), async () =>
      status(contextId) === "CLOSED",
    );
  },
);

When(
  "I cancel the ticket {string} because {string}",
  async function (this: ChemFoxWorld, contextId: string, reason: string) {
    const dialog = this.page.getByRole("dialog");
    await clickUntil(this, button(this, "Cancel ticket"), () => visible(dialog));
    await dialog.getByLabel(/^Reason/).fill(reason);
    await clickUntil(
      this,
      dialog.getByRole("button", { name: "Cancel ticket", exact: true }),
      async () => status(contextId) === "CANCELLED",
    );
  },
);

// --- assertions ----------------------------------------------------------

Then(
  "ticket {string} should be in the {string} stage",
  function (this: ChemFoxWorld, contextId: string, stage: string) {
    assert.equal(status(contextId), toStatus(stage));
  },
);

Then(
  "I should be on the workspace for {string}",
  async function (this: ChemFoxWorld, contextId: string) {
    const expected = workspacePath(contextId);
    await this.page.waitForURL(
      (url) => new URL(url).pathname === expected,
      { timeout: 30_000 },
    );
    assert.equal(this.currentPath(), expected);
  },
);

Then(
  "the lab form editor should be unlocked",
  async function (this: ChemFoxWorld) {
    await button(this, "Finish experiment")
      .first()
      .waitFor({ state: "visible", timeout: 30_000 });
  },
);

Then(
  "I should not be able to close the ticket",
  async function (this: ChemFoxWorld) {
    await button(this, "Cancel ticket").first().waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(await button(this, "Close ticket").count(), 0);
  },
);

Then(
  "I should see the message {string}",
  async function (this: ChemFoxWorld, message: string) {
    await this.page
      .getByText(message, { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 30_000 });
  },
);
