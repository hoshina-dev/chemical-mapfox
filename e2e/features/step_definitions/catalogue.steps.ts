import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";
import { waitForHydration } from "../support/interactions.js";
import type { ChemFoxWorld } from "../support/world.js";
import {
  failNextWrite,
  findSampleType,
  experimentManager,
  seedSampleType,
} from "../support/stub/modules/experiment-manager.js";

const catalogueWriteCount = () =>
  experimentManager.writes.filter((w) => /web-(visibility|order)$/.test(w.path)).length;

Given("the sample {string} has no report form", function (sample: string) {
  const st = seedSampleType(sample);
  st.reportForm = null;
  st.reportPdf = null;
});
Given("the next catalogue write will fail", function () {
  failNextWrite({ pathIncludes: "web-" }, 503, "catalogue temporarily unavailable");
});
When(
  "I cancel and leave unchanged the drag of {string}",
  async function (this: ChemFoxWorld, name: string) {
    const before = catalogueWriteCount();
    const handle = this.page.getByRole("button", {
      name: `Reorder ${name}`,
      exact: true,
    });
    await handle.focus();
    await handle.press("Space");
    await handle.press("ArrowDown");
    await handle.press("Escape");
    // Wait for the library's drop feedback to finish before the next gesture.
    await this.page.waitForTimeout(350);
    await handle.focus();
    await handle.press("Space");
    await handle.press("Space");
    await this.page.waitForTimeout(350);
    assert.equal(catalogueWriteCount(), before);
  },
);
When(
  "I visit the catalogue settings for {string}",
  async function (this: ChemFoxWorld, name: string) {
    const sample = findSampleType(name);
    assert.ok(sample);
    await this.goto(`/internal/experiment/onboarding/${sample.id}`);
  },
);
When("I reload the catalogue settings", async function (this: ChemFoxWorld) {
  await this.page.reload();
});

async function hide(world: ChemFoxWorld, name: string) {
  const input = world.page.getByLabel(`Show ${name} to clients`, {
    exact: true,
  });
  await waitForHydration(input);
  await input.uncheck();
}
When(
  "I try to hide {string} from clients",
  async function (this: ChemFoxWorld, name: string) {
    await hide(this, name);
  },
);
When(
  "I hide {string} from clients",
  async function (this: ChemFoxWorld, name: string) {
    await hide(this, name);
    await this.page
      .getByRole("status")
      .filter({ hasText: /^Saved$/ })
      .waitFor({ state: "visible", timeout: 10000 });
  },
);
Then(
  "{string} should be hidden in catalogue settings",
  async function (this: ChemFoxWorld, name: string) {
    const input = this.page.getByLabel(`Show ${name} to clients`, {
      exact: true,
    });
    await input.waitFor({ state: "visible", timeout: 10000 });
    assert.equal(await input.isChecked(), false);
  },
);
Then(
  "{string} should be visible in catalogue settings",
  async function (this: ChemFoxWorld, name: string) {
    const input = this.page.getByLabel(`Show ${name} to clients`, {
      exact: true,
    });
    await input.waitFor({ state: "visible", timeout: 10000 });
    assert.equal(await input.isChecked(), true);
  },
);
Then(
  "catalogue item {string} should appear at place {int}",
  async function (this: ChemFoxWorld, name: string, position: number) {
    await this.page
      .getByRole("button", { name: `Reorder ${name}`, exact: true })
      .waitFor({ state: "visible" });
    await this.page.waitForFunction(
      ({ name, position }) =>
        Array.from(document.querySelectorAll('button[aria-label^="Reorder "]'))
          .filter(
            (element) => !element.closest('[inert], [aria-hidden="true"]'),
          )
          [position - 1]?.getAttribute("aria-label") === `Reorder ${name}`,
      { name, position },
    );
    if (process.env.E2E_SCREENSHOT_DIR) {
      const view =
        this.currentPath() === "/internal/experiment/onboarding"
          ? "catalogue-specimens"
          : "catalogue-experiments";
      await this.page.screenshot({
        path: `${process.env.E2E_SCREENSHOT_DIR}/${view}.png`,
      });
    }
  },
);
When(
  "I move {string} down using the keyboard drag handle",
  async function (this: ChemFoxWorld, name: string) {
    const handle = this.page.getByRole("button", {
      name: `Reorder ${name}`,
      exact: true,
    });
    await waitForHydration(handle);
    await handle.focus();
    await handle.press("Space");
    await handle.press("ArrowDown");
    await handle.press("Space");
    await this.page
      .getByRole("status")
      .filter({ hasText: /^Saved$/ })
      .waitFor({ state: "visible", timeout: 10000 });
  },
);
When(
  "I drag catalogue item {string} before {string}",
  async function (this: ChemFoxWorld, name: string, before: string) {
    const source = this.page.getByRole("button", {
      name: `Reorder ${name}`,
      exact: true,
    });
    const target = this.page.getByRole("button", {
      name: `Reorder ${before}`,
      exact: true,
    });
    const a = await source.boundingBox();
    const b = await target.boundingBox();
    assert.ok(a && b);
    await this.page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2, {
      steps: 3,
    });
    await this.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, {
      steps: 20,
    });
    await this.page.mouse.up();
    await this.page
      .getByRole("status")
      .filter({ hasText: /^Saved$/ })
      .waitFor({ state: "visible", timeout: 10000 });
  },
);
When(
  "I open the client catalogue group {string}",
  async function (this: ChemFoxWorld, name: string) {
    await this.page
      .getByRole("button")
      .filter({ hasText: name })
      .first()
      .click();
  },
);
Then(
  "the public test {string} should offer an online request",
  async function (this: ChemFoxWorld, name: string) {
    const row = this.page
      .locator("#offer")
      .getByText(name, { exact: true })
      .locator("..");
    await row
      .getByRole("link", { name: "Request this experiment", exact: true })
      .waitFor({ state: "visible", timeout: 10000 });
  },
);
Then(
  "the public test {string} should not be listed",
  async function (this: ChemFoxWorld, name: string) {
    await this.page.locator("#offer").waitFor({ state: "visible" });
    assert.equal(
      await this.page
        .locator("#offer")
        .getByText(name, { exact: true })
        .count(),
      0,
    );
  },
);
Then(
  "public specimen {string} should not be listed",
  async function (this: ChemFoxWorld, name: string) {
    await this.page.locator("#offer").waitFor({ state: "visible" });
    assert.equal(
      await this.page
        .locator("#offer")
        .getByRole("button")
        .filter({ hasText: name })
        .count(),
      0,
    );
  },
);
Then(
  "public specimen {string} should appear before {string}",
  async function (this: ChemFoxWorld, a: string, b: string) {
    for (const name of [a, b]) {
      await this.page
        .locator("#offer")
        .getByRole("button")
        .filter({ hasText: name })
        .waitFor({ state: "visible" });
    }
    const names = await this.page
      .locator("#offer")
      .getByRole("button")
      .allTextContents();
    assert.ok(
      names.findIndex((s) => s.includes(a)) <
        names.findIndex((s) => s.includes(b)),
    );
  },
);
Then(
  "public test {string} should appear before {string}",
  async function (this: ChemFoxWorld, a: string, b: string) {
    for (const name of [a, b]) {
      await this.page
        .locator("#offer")
        .getByText(name, { exact: true })
        .waitFor({ state: "visible" });
    }
    const text = await this.page.locator("#offer").innerText();
    assert.ok(text.indexOf(a) < text.indexOf(b));
  },
);
Then(
  "client test {string} should appear before {string}",
  async function (this: ChemFoxWorld, a: string, b: string) {
    const cards = this.page.getByRole("checkbox");
    await cards.first().waitFor({ state: "visible" });
    const names = await cards.allTextContents();
    assert.ok(
      names.findIndex((s) => s.includes(a)) <
        names.findIndex((s) => s.includes(b)),
    );
  },
);

Then(
  "client test {string} should not be listed",
  async function (this: ChemFoxWorld, name: string) {
    await this.page
      .getByRole("heading", { name: "Request an experiment" })
      .waitFor({ state: "visible" });
    assert.equal(await this.page.getByText(name, { exact: true }).count(), 0);
  },
);

Then(
  "catalogue item {string} should be flagged as missing its report form",
  async function (this: ChemFoxWorld, name: string) {
    await this.page
      .getByRole("link", { name, exact: true })
      .locator("..")
      .getByText("No report template", { exact: false })
      .waitFor({ state: "visible", timeout: 10000 });
  },
);
When(
  "I move {string} down using a touch drag",
  async function (this: ChemFoxWorld, name: string) {
    await this.page.setViewportSize({ width: 390, height: 844 });
    const source = this.page.getByRole("button", {
      name: `Reorder ${name}`,
      exact: true,
    });
    const target = this.page.getByRole("button", {
      name: "Reorder Other ready test",
      exact: true,
    });
    await source.scrollIntoViewIfNeeded();
    const a = await source.boundingBox();
    const b = await target.boundingBox();
    assert.ok(a && b);
    const session = await this.context.newCDPSession(this.page);
    await session.send("Emulation.setTouchEmulationEnabled", { enabled: true });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: a.x + a.width / 2, y: a.y + a.height / 2 }],
    });
    await this.page.waitForTimeout(300);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: a.x + a.width / 2, y: a.y + a.height / 2 + 12 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await this.page
      .getByRole("status")
      .filter({ hasText: /^Saved$/ })
      .waitFor({ state: "visible", timeout: 10000 });
    await session.detach();
  },
);
Then(
  "the catalogue controls should fit the mobile viewport",
  async function (this: ChemFoxWorld) {
    // The dense table scrolls horizontally inside its own viewport.
    const viewport = await this.page
      .getByRole("region", { name: "Experiment", exact: true })
      .boundingBox();
    assert.ok(viewport);
    assert.ok(viewport.x + viewport.width <= 390);
    if (process.env.E2E_SCREENSHOT_DIR)
      await this.page.screenshot({
        path: `${process.env.E2E_SCREENSHOT_DIR}/catalogue-mobile.png`,
      });
  },
);
