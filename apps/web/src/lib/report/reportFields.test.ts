import { describe, expect, it } from "vitest";

import type { ExperimentTemplate } from "@/lib/experiment-manager/client";

import {
  experimentFields,
  experimentLabels,
  fieldKind,
  moveField,
  placeField,
  placementsRemoved,
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
  it("offers each method's results, lab and client questions under the sources experiment-manager accepts", () => {
    const [moisture, ash] = experimentFields([
      template("t-mt", "Total moisture", {
        clientForm: {
          questions: [
            { id: "purpose", type: "string", label: "Purpose" },
            { id: "no_label", type: "string" },
          ],
        },
        labForm: {
          questions: [
            { id: "mass", type: "number", label: "Mass of sample" },
            { id: "readings", type: "repeatable-group", label: "Readings" },
          ],
        },
        calculations: { result_mt: { formula: "1" }, mt_avg: { formula: "2" } },
      }),
      template("t-a", "Ash", { labForm: { questions: [] } }),
    ]);

    expect(moisture).toEqual({
      id: "t-mt",
      name: "Total moisture",
      fields: {
        result: [
          { source: "result.t-mt.result_mt", label: "result_mt" },
          { source: "result.t-mt.mt_avg", label: "mt_avg" },
        ],
        // A repeatable group holds a list, so it is not offered.
        lab: [{ source: "labForm.t-mt.mass", label: "Mass of sample" }],
        client: [
          { source: "clientForm.purpose", label: "Purpose" },
          { source: "clientForm.no_label", label: "no_label" },
        ],
      },
    });
    expect(ash).toEqual({
      id: "t-a",
      name: "Ash",
      fields: { result: [], lab: [], client: [] },
    });
  });

  it("tells each source's kind (the editor's colour)", () => {
    expect(
      [
        "result.t.x",
        "labForm.t.mass",
        "clientForm.purpose",
        "ticket.receivedAt",
        "client.name",
      ].map(fieldKind),
    ).toEqual(["result", "lab", "client", "general", "general"]);
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

describe("placementsRemoved", () => {
  const before = {
    labForm: {
      questions: [
        { id: "mass", type: "number", label: "Mass of sample" },
        { id: "ash", type: "number", label: "Mass of ash" },
      ],
    },
    calculations: { result_a: { formula: "1" }, avg: { formula: "2" } },
  };
  const placed = [
    "result.t1.result_a",
    "result.t1.result_a", // placed twice (both pages): named once
    "labForm.t1.mass",
    "result.t1.avg",
    "result.t2.result_a", // another method
    "clientForm.purpose",
    "sampleType.name",
  ];

  it("names this method's placed results and lab values the new version drops", () => {
    const after = {
      labForm: {
        questions: [{ id: "ash", type: "number", label: "Mass of ash" }],
      },
      calculations: { avg: { formula: "3" } },
    };
    expect(placementsRemoved("t1", placed, before, after)).toEqual([
      { source: "result.t1.result_a", label: "result_a" },
      { source: "labForm.t1.mass", label: "Mass of sample" },
    ]);
    expect(placementsRemoved("t1", placed, before, before)).toEqual([]);
  });

  it("names all of this method's placements when it is deleted", () => {
    expect(
      placementsRemoved("t1", placed, before, null).map((o) => o.source),
    ).toEqual(["result.t1.result_a", "labForm.t1.mass", "result.t1.avg"]);
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

  it("drops per-field formats from a stored map (one fixed format; experiment-manager refuses them)", () => {
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
