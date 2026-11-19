import { describe, expect, it } from "vitest";

import type { ReportForm } from "@/lib/experiment-manager/client";

import {
  addRow,
  editRow,
  printableResults,
  removeRow,
  rowsRemoved,
  storedForm,
} from "./reportTable";

const ash = {
  calculations: { popiol_analityczny: {}, popiol_roboczy: {} },
};
const dishRun = {
  labForm: { dishRun: { calculations: [{ name: "A" }] } },
  calculations: { A: {}, accepted_pair: {}, final_A: {}, popiol_roboczy: {} },
};

describe("printableResults", () => {
  it("offers every calculation of a method without a dish run", () => {
    expect(printableResults(ash)).toEqual(["popiol_analityczny", "popiol_roboczy"]);
  });

  it("leaves out a dish run's per-dish values (lists)", () => {
    expect(printableResults(dishRun)).toEqual(["final_A", "popiol_roboczy"]);
  });
});

describe("table edits", () => {
  const empty: ReportForm = { sections: [] };

  it("adds rows to their method's section, each result once", () => {
    let form = addRow(empty, "ash", "popiol_analityczny");
    form = addRow(form, "ash", "popiol_roboczy");
    form = addRow(form, "ash", "popiol_roboczy");
    form = addRow(form, "moisture", "wilgoc");
    expect(form).toEqual({
      sections: [
        {
          template: "ash",
          rows: [
            { result: "popiol_analityczny", label: "popiol_analityczny" },
            { result: "popiol_roboczy", label: "popiol_roboczy" },
          ],
        },
        { template: "moisture", rows: [{ result: "wilgoc", label: "wilgoc" }] },
      ],
    });
  });

  it("edits a label and unit, dropping empty ones", () => {
    const form = addRow(empty, "ash", "popiol_roboczy");
    expect(editRow(form, "ash", "popiol_roboczy", { label: "", unit: "%" })).toEqual({
      sections: [{ template: "ash", rows: [{ result: "popiol_roboczy", unit: "%" }] }],
    });
  });

  it("removes a row, and its section once empty", () => {
    let form = addRow(addRow(empty, "ash", "a"), "ash", "b");
    form = removeRow(form, "ash", "a");
    expect(form.sections[0]?.rows.map((r) => r.result)).toEqual(["b"]);
    expect(removeRow(form, "ash", "b")).toEqual(empty);
  });
});

describe("storedForm", () => {
  it("reads a table saved before sections as empty", () => {
    expect(storedForm({ fields: [{ page: 1, x: 1, y: 1, source: "x" }] })).toEqual({ sections: [] });
    expect(storedForm(null)).toEqual({ sections: [] });
  });

  it("keeps result, label and unit only", () => {
    expect(
      storedForm({ sections: [{ template: "ash", rows: [{ result: "a", unit: "%", decimals: 2 }] }] }),
    ).toEqual({ sections: [{ template: "ash", rows: [{ result: "a", unit: "%" }] }] });
  });
});

describe("rowsRemoved", () => {
  const form: ReportForm = {
    sections: [
      {
        template: "ash",
        rows: [{ result: "popiol_analityczny", label: "Analityczny" }, { result: "popiol_roboczy" }],
      },
    ],
  };

  it("names the rows whose calculation the new version no longer has", () => {
    expect(rowsRemoved("ash", form, { calculations: { popiol_roboczy: {} } })).toEqual(["Analityczny"]);
  });

  it("names every row of a deleted method", () => {
    expect(rowsRemoved("ash", form, null)).toEqual(["Analityczny", "popiol_roboczy"]);
  });

  it("names nothing for another method", () => {
    expect(rowsRemoved("moisture", form, null)).toEqual([]);
  });
});
