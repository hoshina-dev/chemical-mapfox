import assert from "node:assert/strict";

import type { Locator } from "playwright";

import type { ChemFoxWorld } from "./world.js";

/**
 * In dev mode React hydration can lag a freshly navigated page, so a click on
 * a hydration-only control (a Mantine button/row whose handler isn't attached
 * yet) is a silent no-op. Re-click until `done()` reports success.
 */
export async function clickUntil(
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
 * Wait until React has hydrated `target` (it attaches `__reactProps$…` to the
 * node). Toggling a server-rendered checkbox before then flips the native box
 * — so Playwright's check()/uncheck() succeed — but no onChange ever runs.
 */
export async function waitForHydration(target: Locator): Promise<void> {
  await target.waitFor({ state: "visible", timeout: 15_000 });
  await target.page().waitForFunction(
    (el) => !!el && Object.keys(el).some((k) => k.startsWith("__reactProps$")),
    await target.elementHandle(),
    { timeout: 15_000 },
  );
}

/**
 * Fill a (controlled, Mantine) input and confirm the value stuck. A fill that
 * lands before hydration completes gets reset to the form's initial value, so
 * re-fill until the DOM value matches what we want.
 */
export async function setInput(
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
