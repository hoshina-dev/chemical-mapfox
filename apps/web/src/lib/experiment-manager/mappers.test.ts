import type { ExperimentTemplate } from "@repo/forms";
import { describe, expect, it } from "vitest";

import type {
  ExperimentDetail,
  ExperimentTemplateDetail,
} from "./client";
import {
  experimentDetailToState,
  extractWireSnapshot,
  mapCalculationsToApi,
  normalizeCalculations,
  templateDetailToLoaded,
  templateToCreate,
  templateToExperimentUpdate,
  templateToUpdate,
  toTemplateSummary,
} from "./mappers";

const baseForm = {
  name: "Client form",
  questions: [{ id: "q1", type: "string" as const, label: "Q1", required: false }],
};

const labForm = {
  name: "Lab form",
  questions: [
    { id: "ph", type: "number" as const, label: "pH", required: false },
    {
      id: "measurements",
      type: "repeatable-group" as const,
      label: "Measurements",
      required: true,
      config: {
        count: 2,
        questions: [
          {
            id: "reading",
            type: "number" as const,
            label: "Reading",
            required: true,
          },
        ],
      },
    },
  ],
};

const template: ExperimentTemplate = {
  clientForm: baseForm,
  labForm,
  calculations: {
    avg: { formula: "mean(values['reading'])" },
    withResult: { formula: "1 + 1", result: 2 },
  },
};

describe("extractWireSnapshot", () => {
  it("defaults missing forms and calculations", () => {
    expect(extractWireSnapshot({})).toEqual({
      clientForm: { name: "", questions: [] },
      labForm: { name: "", questions: [] },
      calculations: {},
    });
  });

  it("passes through provided snapshot fields", () => {
    const snapshot = extractWireSnapshot({
      clientForm: baseForm,
      labForm,
      calculations: { x: "a + b" },
    });
    expect(snapshot.clientForm).toEqual(baseForm);
    expect(snapshot.labForm).toEqual(labForm);
    expect(snapshot.calculations).toEqual({ x: "a + b" });
  });
});

describe("normalizeCalculations", () => {
  it("returns an empty object when calculations are missing", () => {
    expect(normalizeCalculations(undefined)).toEqual({});
  });

  it("normalizes string, object, and invalid calculation entries", () => {
    expect(
      normalizeCalculations({
        fromString: "a + b",
        withResult: { formula: "1 + 1", result: 2 },
        emptyResult: { formula: "noop", result: "" },
        missingResult: { formula: "noop" },
        invalid: null as unknown as string,
      }),
    ).toEqual({
      fromString: { formula: "a + b" },
      withResult: { formula: "1 + 1", result: 2 },
      emptyResult: { formula: "noop" },
      missingResult: { formula: "noop" },
      invalid: { formula: "" },
    });
  });
});

describe("mapCalculationsToApi", () => {
  it("omits result when undefined and includes it when present", () => {
    expect(
      mapCalculationsToApi({
        bare: { formula: "x" },
        done: { formula: "x", result: 3 },
      }),
    ).toEqual({
      bare: { formula: "x" },
      done: { formula: "x", result: 3 },
    });
  });
});

describe("templateDetailToLoaded", () => {
  it("maps a valid template detail", () => {
    const detail = {
      id: "tpl-1",
      lineage_id: "line-1",
      name: "Ash content",
      description: "Determines ash",
      clientForm: baseForm,
      labForm,
      calculations: { avg: "mean(values['reading'])" },
    } satisfies ExperimentTemplateDetail;

    const loaded = templateDetailToLoaded(detail);
    expect(loaded.id).toBe("tpl-1");
    expect(loaded.lineageId).toBe("line-1");
    expect(loaded.meta).toEqual({ title: "Ash content", description: "Determines ash" });
    expect(loaded.valid).toBe(true);
    expect(loaded.template.clientForm.name).toBe("Client form");
    expect(loaded.wireSnapshot.clientForm).toEqual(baseForm);
  });

  it("strips null nested fields and marks invalid templates", () => {
    const detail = {
      id: "tpl-bad",
      lineage_id: "line-bad",
      name: "Broken",
      description: null,
      clientForm: {
        name: "Client",
        questions: [{ id: "q1", type: "not-a-type", label: "Q" }],
      },
      labForm: { name: "Lab", questions: [] },
      calculations: {},
    } as unknown as ExperimentTemplateDetail;

    const loaded = templateDetailToLoaded(detail);
    expect(loaded.valid).toBe(false);
    expect(loaded.meta.description).toBeUndefined();
    expect(loaded.template.clientForm.name).toBe("Client");
  });
});

describe("experimentDetailToState", () => {
  it("maps experiment detail including values and report metadata", () => {
    const detail = {
      id: "ctx-1",
      sample_id: "sample-1",
      template_id: "tpl-1",
      report_status: "ready",
      report_generated_at: "2026-01-02T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      clientForm: baseForm,
      labForm,
      calculations: {},
      values: { ph: 7 },
    } satisfies ExperimentDetail;

    const state = experimentDetailToState(detail);
    expect(state.id).toBe("ctx-1");
    expect(state.sampleId).toBe("sample-1");
    expect(state.templateId).toBe("tpl-1");
    expect(state.reportStatus).toBe("ready");
    expect(state.reportGeneratedAt).toBe("2026-01-02T00:00:00Z");
    expect(state.values).toEqual({ ph: 7 });
    expect(state.valid).toBe(true);
  });

  it("defaults missing optional fields", () => {
    const state = experimentDetailToState({
      id: "ctx-2",
      sample_id: "s",
      template_id: "t",
      created_at: "2026-01-01T00:00:00Z",
    } as ExperimentDetail);
    expect(state.reportStatus).toBeNull();
    expect(state.reportGeneratedAt).toBeNull();
    expect(state.values).toEqual({});
  });

  it("keeps unparsed template data when schema validation fails", () => {
    const state = experimentDetailToState({
      id: "ctx-bad",
      sample_id: "s",
      template_id: "t",
      created_at: "2026-01-01T00:00:00Z",
      clientForm: {
        name: "Client",
        questions: [{ id: "q1", type: "not-a-type", label: "Q" }],
      },
      labForm: { name: "Lab", questions: [] },
    } as unknown as ExperimentDetail);
    expect(state.valid).toBe(false);
    expect(state.template.clientForm.name).toBe("Client");
  });
});

describe("templateToCreate / templateToUpdate", () => {
  it("coerces null descriptions to empty strings for the API", () => {
    const withNullDescriptions: ExperimentTemplate = {
      clientForm: {
        name: "Client",
        description: null as unknown as string,
        questions: [
          {
            id: "note",
            type: "string",
            label: "Note",
            description: null as unknown as string,
            required: false,
          },
        ],
      },
      labForm: {
        name: "Lab",
        questions: [
          {
            id: "measurements",
            type: "repeatable-group",
            label: "Measurements",
            required: true,
            config: {
              count: 1,
              questions: [
                {
                  id: "reading",
                  type: "number",
                  label: "Reading",
                  description: null as unknown as string,
                  required: true,
                },
              ],
            },
          },
        ],
      },
      calculations: template.calculations,
    };

    const create = templateToCreate(
      { title: "Ash", description: undefined },
      withNullDescriptions,
    );
    expect(create.description).toBeNull();
    expect(create.clientForm.description).toBe("");
    expect(create.clientForm.questions[0]?.description).toBe("");
    const group = create.labForm.questions[0];
    expect(group?.config?.questions[0]?.description).toBe("");

    expect(templateToUpdate({ title: "Ash" }, withNullDescriptions)).toEqual(create);
  });
});

describe("templateToExperimentUpdate", () => {
  it("resends the wire snapshot with edited values", () => {
    const snapshot = extractWireSnapshot({
      clientForm: baseForm,
      labForm,
      calculations: { avg: { formula: "1" } },
    });
    const body = templateToExperimentUpdate(snapshot, { ph: 8 });
    expect(body.clientForm).toEqual(snapshot.clientForm);
    expect(body.labForm).toEqual(snapshot.labForm);
    expect(body.calculations).toEqual(snapshot.calculations);
    expect(body.values).toEqual({ ph: 8 });
  });
});

describe("toTemplateSummary", () => {
  it("maps a template row and drops null descriptions", () => {
    expect(
      toTemplateSummary("sample-1", {
        id: "tpl-1",
        lineage_id: "line-1",
        name: "Ash",
        description: null,
      }),
    ).toEqual({
      sampleId: "sample-1",
      templateId: "tpl-1",
      lineageId: "line-1",
      title: "Ash",
      description: undefined,
    });

    expect(
      toTemplateSummary("sample-1", {
        id: "tpl-2",
        lineage_id: "line-2",
        name: "Moisture",
        description: "Moisture content",
      }).description,
    ).toBe("Moisture content");
  });
});
