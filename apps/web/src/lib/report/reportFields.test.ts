import { describe, expect, it } from "vitest";

import type { ExperimentTemplate } from "@/lib/sample-tracker/client";

import {
  experimentFields,
  experimentLabels,
  moveField,
  placeField,
  storedFields,
} from "./reportFields";

const a4 = { width: 595, height: 842 };

function template(
  id: string,
  name: string,
  template: Record<string, unknown>,
): ExperimentTemplate {
  return {
    id,
    sampleTypeId: "s1",
    name,
    description: null,
    template,
    isVisibleOnWeb: true,
    displayOrder: 1,
    createdAt: "",
    updatedAt: "",
  };
}

describe("experimentFields", () => {
  it("offers each method's client answers and results under the sources sample_tracker accepts", () => {
    const [moisture, ash] = experimentFields([
      template("t-mt", "Total moisture", {
        clientForm: {
          questions: [
            { id: "purpose", type: "string", label: "Purpose" },
            { id: "batches", type: "repeatable-group", label: "Batches" },
            { id: "no_label", type: "string" },
          ],
        },
        calculations: { result_mt: { formula: "1" }, mt_avg: { formula: "2" } },
      }),
      template("t-a", "Ash", { labForm: { questions: [] } }),
    ]);

    expect(moisture).toEqual({
      id: "t-mt",
      name: "Total moisture",
      fields: [
        { source: "clientForm.purpose", label: "Purpose" },
        { source: "clientForm.no_label", label: "no_label" },
        { source: "result.t-mt.result_mt", label: "result_mt" },
        { source: "result.t-mt.mt_avg", label: "mt_avg" },
      ],
    });
    expect(ash).toEqual({ id: "t-a", name: "Ash", fields: [] });
  });

  it("names a placed field by its method, and a shared question by the first method that asks it", () => {
    const labels = experimentLabels(
      experimentFields([
        template("t-1", "Moisture", {
          clientForm: {
            questions: [{ id: "purpose", type: "string", label: "Purpose" }],
          },
          calculations: { result: { formula: "1" } },
        }),
        template("t-2", "Ash", {
          clientForm: {
            questions: [{ id: "purpose", type: "string", label: "Purpose" }],
          },
        }),
      ]),
    );
    expect(labels).toEqual({
      "clientForm.purpose": "Moisture · Purpose",
      "result.t-1.result": "Moisture · result",
    });
  });
});

describe("placing and moving", () => {
  it("places a field at the clicked point, rounded and kept on the page", () => {
    expect(placeField("sampleType.name", 2, 100.04, 200.06, a4)).toEqual({
      page: 2,
      x: 100,
      y: 200.1,
      source: "sampleType.name",
    });
    expect(placeField("sampleType.name", 1, -5, 900, a4)).toMatchObject({
      x: 0,
      y: 842,
    });
  });

  it("moves a field by points, kept on the page", () => {
    const taxId = { page: 1, x: 37.8, y: 209.3, source: "client.taxId" };
    expect(moveField(taxId, 0.5, -5, a4)).toEqual({
      ...taxId,
      x: 38.3,
      y: 204.3,
    });
    expect(moveField(taxId, 1000, -1000, a4)).toMatchObject({ x: 595, y: 0 });
  });

  it("drops per-field formats from a stored map (one fixed format; sample_tracker refuses them)", () => {
    const stored = [
      {
        page: 1,
        x: 37.8,
        y: 209.3,
        size: 9,
        align: "right",
        prefix: "NIP: ",
        source: "client.taxId",
      },
    ];
    expect(storedFields(stored)).toEqual([
      { page: 1, x: 37.8, y: 209.3, source: "client.taxId" },
    ]);
  });
});
