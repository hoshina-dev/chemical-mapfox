import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import {
  addUnrunCalculation,
  guardTicketTransition,
  seedExperiment,
  ticketStatus,
} from "../support/stub/modules/lifecycle.js";
import type { ChemFoxWorld } from "../support/world.js";

const workspacePath = (contextId: string) =>
  `/internal/experiment/${contextId}`;

function button(world: ChemFoxWorld, name: string): Locator {
  return world.page.getByRole("button", { name, exact: true });
}

async function enabled(locator: Locator): Promise<boolean> {
  const first = locator.first();
  if (!(await first.isVisible().catch(() => false))) return false;
  return !(await first.isDisabled().catch(() => true));
}

async function visible(locator: Locator): Promise<boolean> {
  return locator
    .first()
    .isVisible()
    .catch(() => false);
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
  function (this: ChemFoxWorld, contextId: string, status: string) {
    seedExperiment({ contextId, status });
  },
);

Given(
  "experiment {string} has calculations that have not been run",
  function (this: ChemFoxWorld, contextId: string) {
    addUnrunCalculation(contextId, "moisture_pct", "1 + 1");
  },
);

When(
  "the ticketing backend will reject the next transition for {string}",
  function (this: ChemFoxWorld, contextId: string) {
    guardTicketTransition(contextId);
  },
);

// --- lifecycle actions ---------------------------------------------------

When(
  "I check in the sample for {string}",
  async function (this: ChemFoxWorld, contextId: string) {
    await clickUntil(this, button(this, "Check in sample"), async () =>
      ticketStatus(contextId) === "PENDING",
    );
  },
);

When(
  "I start the experiment {string}",
  async function (this: ChemFoxWorld, contextId: string) {
    await clickUntil(this, button(this, "Start experiment"), async () =>
      ticketStatus(contextId) === "EXPERIMENTING",
    );
  },
);

When(
  "I try to start the experiment {string}",
  async function (this: ChemFoxWorld, _contextId: string) {
    await clickUntil(this, button(this, "Start experiment"), async () =>
      visible(
        this.page
          .getByRole("alert")
          .filter({ hasText: /Could not start experiment/i }),
      ),
    );
  },
);

When(
  "I submit experiment {string} to the final stage",
  async function (this: ChemFoxWorld, contextId: string) {
    await clickUntil(this, button(this, "Submit to final stage"), async () =>
      ticketStatus(contextId) === "FINALIZING",
    );
  },
);

When("I run the lifecycle calculations", async function (this: ChemFoxWorld) {
  await clickUntil(this, button(this, "Calculate"), async () =>
    enabled(button(this, "Generate report")),
  );
});

When("I generate the lifecycle report", async function (this: ChemFoxWorld) {
  await clickUntil(this, button(this, "Generate report"), async () =>
    enabled(button(this, "Close ticket")),
  );
});

When(
  "I close the ticket {string}",
  async function (this: ChemFoxWorld, contextId: string) {
    await clickUntil(this, button(this, "Close ticket"), async () =>
      visible(this.page.getByRole("dialog")),
    );
    const confirm = this.page
      .getByRole("dialog")
      .getByRole("button", { name: "Close ticket", exact: true });
    await clickUntil(
      this,
      confirm,
      async () => ticketStatus(contextId) === "CLOSED",
    );
  },
);

// --- assertions ----------------------------------------------------------

Then(
  "ticket {string} should be in the {string} stage",
  function (this: ChemFoxWorld, contextId: string, status: string) {
    assert.equal(ticketStatus(contextId), status);
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
    await button(this, "Submit to final stage")
      .first()
      .waitFor({ state: "visible", timeout: 30_000 });
  },
);

Then(
  "I should not be able to close the ticket",
  async function (this: ChemFoxWorld) {
    const close = button(this, "Close ticket").first();
    await close.waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(await close.isDisabled(), true);
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
