import assert from "node:assert/strict";

import { Then, When } from "@cucumber/cucumber";

import { waitForHydration } from "../support/interactions.js";
import {
  findSampleType,
  makePdf,
} from "../support/stub/modules/experiment-manager.js";
import type { ChemFoxWorld } from "../support/world.js";

function sampleType(name: string) {
  const st = findSampleType(name);
  assert.ok(st, `sample type "${name}" was not seeded`);
  return st;
}

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
  // Before hydration React has no change handler on the input, and nothing uploads.
  await waitForHydration(this.page.getByRole("button", { name: "Upload PDF" }));
  await this.page.locator('input[type="file"]').setInputFiles({
    name: "blank-report.pdf",
    mimeType: "application/pdf",
    buffer: makePdf(["Harper Analytics — test report"]),
  });
});

// --- assertions ----------------------------------------------------------

Then(
  "the report form editor should show the PDF",
  async function (this: ChemFoxWorld) {
    await this.page
      .getByText("Preview with sample values. It updates after each change.")
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
  "experiment-manager stored a report form PDF for {string}",
  async function (this: ChemFoxWorld, name: string) {
    const st = sampleType(name);
    for (let i = 0; i < 50 && !st.reportPdf; i += 1)
      await this.page.waitForTimeout(200);
    assert.ok(
      st.reportPdf?.subarray(0, 5).equals(Buffer.from("%PDF-")),
      "no PDF stored",
    );
    assert.deepEqual(st.reportForm, { sections: [] });
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
