import { DataTable, Given, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import {
  addOrg,
  addUser,
  type CustApiRole,
} from "../support/fixtures.js";
import type { ChemFoxWorld } from "../support/world.js";

function loginForm(world: ChemFoxWorld): Locator {
  return world.page
    .locator("form")
    .filter({ has: world.page.getByRole("button", { name: "Sign in" }) });
}

function registerForm(world: ChemFoxWorld): Locator {
  return world.page
    .locator("form")
    .filter({ has: world.page.getByRole("button", { name: "Create account" }) });
}

/**
 * Click `trigger` until `reveals` becomes visible. In dev mode React hydration
 * can lag a freshly navigated page, so a click on an interactive-only control
 * (a Mantine tab, menu trigger, …) is a no-op until its handler is attached.
 * Retrying the click absorbs that race.
 */
async function clickUntilVisible(
  trigger: Locator,
  reveals: Locator,
  attempts = 25,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    await trigger.click();
    try {
      await reveals.waitFor({ state: "visible", timeout: 1000 });
      return;
    } catch {
      // not hydrated yet — try again
    }
  }
  await reveals.waitFor({ state: "visible", timeout: 5000 });
}

async function fillSignIn(
  world: ChemFoxWorld,
  email: string,
  password: string,
): Promise<void> {
  await world.goto("/");
  const form = loginForm(world);
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="password"]').fill(password);
  await form.getByRole("button", { name: "Sign in" }).click();
}

// --- data setup ----------------------------------------------------------

Given(
  "the following users exist:",
  function (this: ChemFoxWorld, table: DataTable) {
    for (const row of table.hashes()) {
      addUser({
        name: row.name,
        email: row.email,
        password: row.password,
        role: (row.role as CustApiRole) || "user",
        organization: row.organization || undefined,
      });
    }
  },
);

Given(
  "the following organizations exist:",
  function (this: ChemFoxWorld, table: DataTable) {
    for (const row of table.hashes()) {
      addOrg(row.name);
    }
  },
);

Given("I am not signed in", async function (this: ChemFoxWorld) {
  await this.context.clearCookies();
});

// --- login ---------------------------------------------------------------

When(
  "I sign in with email {string} and password {string}",
  async function (this: ChemFoxWorld, email: string, password: string) {
    await fillSignIn(this, email, password);
  },
);

Given(
  "I am signed in as {string} with password {string}",
  async function (this: ChemFoxWorld, email: string, password: string) {
    await fillSignIn(this, email, password);
    // Wait until the redirect away from the login page lands somewhere.
    await this.page.waitForURL((url) => new URL(url).pathname !== "/", {
      timeout: 30_000,
    });
  },
);

// --- registration --------------------------------------------------------

When(
  "I register as {string} with email {string} password {string} in organization {string}",
  async function (
    this: ChemFoxWorld,
    name: string,
    email: string,
    password: string,
    organization: string,
  ) {
    await this.goto("/");
    const form = registerForm(this);
    await clickUntilVisible(
      this.page.getByRole("tab", { name: "Register" }),
      form.locator('input[name="name"]'),
    );
    await form.locator('input[name="name"]').fill(name);
    await form.locator('input[name="email"]').fill(email);
    await form.locator('input[name="password"]').fill(password);

    const orgInput = form.getByPlaceholder("Search organizations...");
    await orgInput.click();
    await orgInput.fill(organization);
    await this.page
      .getByRole("option", { name: organization })
      .first()
      .click({ timeout: 15_000 });

    await form.getByRole("button", { name: "Create account" }).click();
  },
);

// --- logout --------------------------------------------------------------

When("I log out", async function (this: ChemFoxWorld) {
  const logoutItem = this.page.getByRole("menuitem", { name: "Log out" });
  await clickUntilVisible(
    this.page.getByRole("button", { name: "User menu" }),
    logoutItem,
  );
  await logoutItem.click();
});
