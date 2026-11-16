import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";

import { clickUntil } from "../support/interactions.js";
import {
  findSampleType,
  makePdf,
  seedSampleType,
} from "../support/stub/modules/sample-tracker.js";
import type { ChemFoxWorld } from "../support/world.js";

function sampleType(name: string) {
  const st = findSampleType(name);
  assert.ok(st, `sample type "${name}" was not seeded`);
  return st;
}

const canvas = (world: ChemFoxWorld) => world.page.locator("canvas").first();

// --- data setup ----------------------------------------------------------

Given(
  "the report form of {string} places {string}",
  function (this: ChemFoxWorld, name: string, source: string) {
    seedSampleType(name).reportForm = {
      fields: [{ page: 1, x: 100, y: 120, source }],
    };
  },
);

// --- interactions --------------------------------------------------------

When(
  "I open the report form of {string}",
  async function (this: ChemFoxWorld, name: string) {
    await this.goto(
      `/internal/experiment/onboarding/${sampleType(name).id}/report-form`,
    );
    await this.page
      .getByRole("heading", { name: "Report form" })
      .waitFor({ state: "visible", timeout: 30_000 });
  },
);

When("I upload a blank report form PDF", async function (this: ChemFoxWorld) {
  await this.page.locator('input[type="file"]').setInputFiles({
    name: "blank-report.pdf",
    mimeType: "application/pdf",
    buffer: makePdf(["Harper Analytics — test report"]),
  });
});

When(
  "I place {string} on the page",
  async function (this: ChemFoxWorld, label: string) {
    const hint = this.page.getByText(`Click on the page to place ${label}`);
    await clickUntil(
      this,
      this.page.getByRole("button", { name: label, exact: true }).first(),
      () => hint.isVisible(),
    );
    const box = await canvas(this).boundingBox();
    assert.ok(box, "the PDF page has no size");
    await this.page.mouse.click(box.x + box.width / 3, box.y + box.height / 4);
  },
);

When(
  "I remove the placed {string}",
  async function (this: ChemFoxWorld, label: string) {
    // The placed chip is the button inside the page (the list option sits outside it).
    const chip = this.page
      .locator("canvas ~ div")
      .getByRole("button", { name: label, exact: true });
    await chip.waitFor({ state: "visible", timeout: 15_000 });
    await chip.focus();
    await chip.press("Delete");
  },
);

// --- assertions ----------------------------------------------------------

Then(
  "the report form editor should show the PDF",
  async function (this: ChemFoxWorld) {
    await this.page
      .getByText("Pick a value on the right, then click where it goes.")
      .waitFor({ state: "visible", timeout: 30_000 });
    // The canvas only gets a height once pdf.js has rendered the page.
    await this.page.waitForFunction(
      () =>
        Number.parseFloat(
          document.querySelector("canvas")?.style.height ?? "0",
        ) > 0,
      undefined,
      { timeout: 45_000 },
    );
  },
);

Then(
  "the report form should say {string}",
  async function (this: ChemFoxWorld, text: string) {
    await this.page
      .locator('[aria-live="polite"]')
      .filter({ hasText: new RegExp(`^${text}$`) })
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);

Then(
  "sample_tracker stored a report form PDF for {string}",
  async function (this: ChemFoxWorld, name: string) {
    const st = sampleType(name);
    for (let i = 0; i < 50 && !st.reportPdf; i += 1)
      await this.page.waitForTimeout(200);
    assert.ok(
      st.reportPdf?.subarray(0, 5).equals(Buffer.from("%PDF-")),
      "no PDF stored",
    );
    assert.deepEqual(st.reportForm, { fields: [] });
  },
);

Then(
  "sample_tracker's report form for {string} places {string}",
  function (this: ChemFoxWorld, name: string, source: string) {
    const fields = (sampleType(name).reportForm?.fields ?? []) as {
      source: string;
      page: number;
    }[];
    assert.deepEqual(
      fields.map((f) => [f.source, f.page]),
      [[source, 1]],
    );
  },
);

Then(
  "sample_tracker's report form for {string} places nothing",
  function (this: ChemFoxWorld, name: string) {
    assert.deepEqual(sampleType(name).reportForm, { fields: [] });
  },
);

Then(
  "the sample page of {string} warns that it has no report template",
  async function (this: ChemFoxWorld, name: string) {
    await this.goto(`/internal/experiment/onboarding/${sampleType(name).id}`);
    await this.page
      .getByText("No report template", { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  },
);
