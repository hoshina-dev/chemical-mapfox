import type { ExperimentTemplate } from "@repo/forms";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/log/handled", () => ({ logHandledError: vi.fn() }));
vi.mock("@/lib/experiment-manager/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/experiment-manager/client")>();
  return {
    ...actual,
    listSamples: vi.fn(),
    listExperimentTemplates: vi.fn(),
    getExperimentTemplate: vi.fn(),
    createSample: vi.fn(),
    createExperimentTemplate: vi.fn(),
    updateExperimentTemplate: vi.fn(),
    evaluateCalculations: vi.fn(),
    upsertPdfTemplate: vi.fn(),
    setSampleWebVisibility: vi.fn(),
    setTemplateWebVisibility: vi.fn(),
  };
});

import {
  createSample,
  createExperimentTemplate,
  evaluateCalculations,
  getExperimentTemplate,
  listExperimentTemplates,
  listSamples,
  setSampleWebVisibility,
  setTemplateWebVisibility,
  updateExperimentTemplate,
  upsertPdfTemplate,
} from "@/lib/experiment-manager/client";
import { ExperimentManagerError } from "@/lib/experiment-manager/client";

import { onboardTemplate, simpleReportLayout, testOnboardingCalculations, listOnboardingSamples, listOnboardingTemplates, getOnboardingTemplate, createOnboardingSample } from "./onboarding";

const draft: ExperimentTemplate = {
  clientForm: { name: "Client", questions: [{ id: "client_note", type: "string", label: "Note" }] },
  labForm: {
    name: "Lab",
    questions: [
      { id: "mass", type: "number", label: "Mass" },
      {
        id: "reps",
        type: "repeatable-group",
        label: "Reps",
        config: { count: 2, questions: [{ id: "reading", type: "number", label: "Reading" }] },
      },
    ],
  },
  calculations: { doubled: { formula: "values['mass'] * 2" } },
};

const okRun = {
  values: { mass: 1 },
  order: ["doubled"],
  calculations: { doubled: { formula: "values['mass'] * 2", status: "ok" as const, result: 2 } },
  missing_values: [],
  duplicate_question_ids: [],
};

const sample = {
  id: "sample-1",
  name: "Coal",
  description: null,
  is_visible_on_web: false,
  display_order: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listSamples).mockResolvedValue({ samples: [sample] });
  vi.mocked(evaluateCalculations).mockResolvedValue(okRun);
  vi.mocked(createExperimentTemplate).mockResolvedValue({
    id: "tmpl-1",
    lineage_id: "lin-1",
    name: "Ash",
    version: 1,
    is_current: true,
    has_pdf_template: false,
    is_visible_on_web: false,
    display_order: 1,
  });
  vi.mocked(updateExperimentTemplate).mockResolvedValue({
    id: "tmpl-2",
    lineage_id: "lin-1",
    name: "Ash",
    version: 2,
    is_current: true,
    has_pdf_template: true,
    is_visible_on_web: false,
    display_order: 1,
  });
  vi.mocked(upsertPdfTemplate).mockResolvedValue({
    template_id: "tmpl-1",
    components: [],
  } as never);
});

describe("onboarding reads", () => {
  it("lists samples and templates and loads one template", async () => {
    const samples = await listOnboardingSamples();
    expect(samples.success && samples.data[0]).toMatchObject({ id: "sample-1", name: "Coal", visible: false });

    vi.mocked(listExperimentTemplates).mockResolvedValue({
      sample_id: "sample-1",
      experiments: [
        {
          id: "tmpl-1",
          lineage_id: "lin-1",
          name: "Ash",
          description: "loss",
          version: 1,
          is_current: true,
          has_pdf_template: false,
          is_visible_on_web: true,
          display_order: 1,
        },
        {
          id: "tmpl-0",
          lineage_id: "lin-0",
          name: "Bare",
          version: 1,
          is_current: false,
          has_pdf_template: false,
          is_visible_on_web: false,
          display_order: 2,
        },
      ],
    });
    const templates = await listOnboardingTemplates("sample-1");
    expect(templates.success && templates.data[0]?.lineageId).toBe("lin-1");

    vi.mocked(getExperimentTemplate).mockResolvedValue({
      id: "tmpl-1",
      lineage_id: "lin-1",
      name: "Ash",
      description: "loss",
      version: 3,
      is_current: true,
      has_pdf_template: true,
      is_visible_on_web: false,
      display_order: 1,
      clientForm: draft.clientForm,
      labForm: draft.labForm,
      calculations: { doubled: { formula: "values['mass'] * 2", result: 2 } },
    });
    const loaded = await getOnboardingTemplate("sample-1", "tmpl-1");
    expect(loaded.success && loaded.data.template.calculations.doubled).toEqual({
      formula: "values['mass'] * 2",
    });

    vi.mocked(getExperimentTemplate).mockResolvedValue({
      id: "tmpl-0",
      lineage_id: "lin-0",
      name: "Bare",
      description: null,
      version: 1,
      is_current: true,
      has_pdf_template: false,
      is_visible_on_web: false,
      display_order: 1,
      clientForm: { name: "Client", questions: [] },
      labForm: { name: "Lab", questions: [] },
      calculations: {},
    });
    const bare = await getOnboardingTemplate("sample-1", "tmpl-0");
    expect(bare.success && bare.data.description).toBeNull();
  });

  it("surfaces list and load failures", async () => {
    vi.mocked(listSamples).mockRejectedValue(new Error("down"));
    expect((await listOnboardingSamples()).success).toBe(false);
    vi.mocked(listExperimentTemplates).mockRejectedValue(new Error("down"));
    expect((await listOnboardingTemplates("sample-1")).success).toBe(false);
    vi.mocked(getExperimentTemplate).mockRejectedValue(new Error("down"));
    expect((await getOnboardingTemplate("sample-1", "missing")).success).toBe(false);
  });
});

describe("createOnboardingSample", () => {
  it("rejects a blank name and creates a trimmed one", async () => {
    expect((await createOnboardingSample("  ")).success).toBe(false);
    vi.mocked(createSample).mockResolvedValue({ ...sample, name: "Coal" });
    await createOnboardingSample("Coal");
    expect(createSample).toHaveBeenCalledWith({ name: "Coal", description: null });
    const created = await createOnboardingSample(" Coal ", " raw ");
    expect(createSample).toHaveBeenCalledWith({ name: "Coal", description: "raw" });
    expect(created.success && created.data.id).toBe("sample-1");
  });

  it("returns the engine's detail when create fails", async () => {
    vi.mocked(createSample).mockRejectedValue(
      new ExperimentManagerError("fail", 422, { detail: "name taken" }),
    );
    const result = await createOnboardingSample("Coal");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("name taken");
  });
});

describe("onboardTemplate", () => {
  it("refuses a broken formula or a failed dry run before writing", async () => {
    const broken = await onboardTemplate({
      sampleName: "Coal",
      title: "Ash",
      template: { ...draft, calculations: { bad: { formula: "mass * 2" } } },
    });
    expect(broken.success).toBe(false);
    expect(createExperimentTemplate).not.toHaveBeenCalled();

    vi.mocked(evaluateCalculations).mockResolvedValue({
      ...okRun,
      calculations: {
        doubled: {
          formula: "values['mass'] * 2",
          status: "error",
          error: { kind: "runtime", message: "Calculation error in 'doubled': boom" },
        },
      },
    });
    const failedRun = await onboardTemplate({ sampleId: "sample-1", title: "Ash", template: draft });
    expect(failedRun.success).toBe(false);
    if (!failedRun.success) expect(failedRun.error).toContain("boom");
    expect(createExperimentTemplate).not.toHaveBeenCalled();
  });

  it("reports a dry run that failed with no error message, and duplicate ids from the engine", async () => {
    vi.mocked(evaluateCalculations).mockResolvedValue({
      ...okRun,
      calculations: { doubled: { formula: "x", status: "skipped" } },
      duplicate_question_ids: ["mass"],
    });
    const result = await onboardTemplate({ sampleId: "sample-1", title: "Ash", template: draft });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("skipped");
      expect(result.error).toContain("mass");
    }
  });

  it("rejects an empty title, a missing sample, and an invalid template", async () => {
    expect((await onboardTemplate({ sampleId: "sample-1", title: "  ", template: draft })).success).toBe(false);
    expect(
      (await onboardTemplate({ sampleId: "missing", title: "Ash", template: draft })).success,
    ).toBe(false);
    expect((await onboardTemplate({ title: "Ash", template: draft })).success).toBe(false);
    const invalid = await onboardTemplate({
      sampleId: "sample-1",
      title: "Ash",
      template: { ...draft, labForm: { name: "Lab", questions: [{ id: "x" } as never] } },
    });
    expect(invalid.success).toBe(false);
  });

  it("creates the sample and template, writes a layout, and publishes", async () => {
    vi.mocked(listSamples).mockResolvedValue({ samples: [] });
    vi.mocked(createSample).mockResolvedValue(sample);
    await onboardTemplate({
      sampleName: "Coal",
      title: "Ash",
      template: { ...draft, calculations: {} },
      reportLayout: false,
    });
    expect(createSample).toHaveBeenCalledWith({ name: "Coal", description: null });
    const result = await onboardTemplate({
      sampleName: "Coal",
      sampleDescription: "Raw",
      title: "Ash",
      description: "Loss",
      template: { ...draft, calculations: {} },
      publish: true,
    });
    expect(createSample).toHaveBeenCalledWith({ name: "Coal", description: "Raw" });
    expect(evaluateCalculations).not.toHaveBeenCalled();
    expect(createExperimentTemplate).toHaveBeenCalled();
    expect(upsertPdfTemplate).toHaveBeenCalled();
    const components = vi.mocked(upsertPdfTemplate).mock.calls[0]?.[2] as { content?: string }[];
    expect(components.some((component) => component.content?.includes("{{reading}}"))).toBe(true);
    expect(setTemplateWebVisibility).toHaveBeenCalledWith("sample-1", "lin-1", true);
    expect(result.success && result.data.published).toBe(true);
    expect(result.success && result.data.createdSample).toBe(true);
  });

  it("revises a lineage and skips the layout when asked", async () => {
    const result = await onboardTemplate({
      sampleId: "sample-1",
      lineageId: "lin-1",
      title: "Ash",
      template: draft,
      reportLayout: false,
    });
    expect(updateExperimentTemplate).toHaveBeenCalled();
    expect(createExperimentTemplate).not.toHaveBeenCalled();
    expect(upsertPdfTemplate).not.toHaveBeenCalled();
    expect(result.success && result.data.reportLayout).toBe(false);
    expect(result.success && result.data.formulaCheck?.order).toEqual(["doubled"]);
  });

  it("matches an existing sample name and refuses an ambiguous one", async () => {
    const result = await onboardTemplate({
      sampleName: "coal",
      title: "Ash",
      template: { ...draft, calculations: {} },
      reportLayout: false,
    });
    expect(createSample).not.toHaveBeenCalled();
    expect(result.success && result.data.sampleId).toBe("sample-1");

    vi.mocked(listSamples).mockResolvedValue({
      samples: [sample, { ...sample, id: "sample-2" }],
    });
    const ambiguous = await onboardTemplate({
      sampleName: "Coal",
      title: "Ash",
      template: draft,
      reportLayout: false,
    });
    expect(ambiguous.success).toBe(false);
  });

  it("keeps the template when the layout or publish step fails", async () => {
    vi.mocked(upsertPdfTemplate).mockRejectedValue(new Error("pdf down"));
    const layout = await onboardTemplate({ sampleId: "sample-1", title: "Ash", template: draft });
    expect(layout.success && layout.data.warning).toMatch(/PDF layout/);
    expect(layout.success && layout.data.reportLayout).toBe(false);
    expect(setSampleWebVisibility).not.toHaveBeenCalled();

    vi.mocked(upsertPdfTemplate).mockResolvedValue({ template_id: "tmpl-9", components: [] } as never);
    vi.mocked(setSampleWebVisibility).mockRejectedValue(new Error("nope"));
    const publish = await onboardTemplate({
      sampleId: "sample-1",
      title: "Ash",
      template: { ...draft, calculations: {} },
      publish: true,
    });
    expect(publish.success && publish.data.published).toBe(false);
    expect(publish.success && publish.data.warning).toMatch(/not published/);
    expect(publish.success && publish.data.templateId).toBe("tmpl-9");
  });

  it("surfaces sample lookup, save, and dry-run transport errors", async () => {
    vi.mocked(evaluateCalculations).mockRejectedValue(new Error("engine down"));
    expect((await onboardTemplate({ sampleId: "sample-1", title: "Ash", template: draft })).success).toBe(false);

    vi.mocked(evaluateCalculations).mockResolvedValue(okRun);
    vi.mocked(listSamples).mockRejectedValue(new Error("down"));
    expect((await onboardTemplate({ sampleId: "sample-1", title: "Ash", template: draft })).success).toBe(false);

    vi.mocked(listSamples).mockResolvedValue({ samples: [sample] });
    vi.mocked(createExperimentTemplate).mockRejectedValue(new Error("nope"));
    expect((await onboardTemplate({ sampleId: "sample-1", title: "Ash", template: draft })).success).toBe(false);
  });
});

describe("testOnboardingCalculations", () => {
  it("rejects a bad draft and returns a dry run", async () => {
    expect(
      (await testOnboardingCalculations({ ...draft, calculations: { bad: { formula: "mass" } } }, {})).success,
    ).toBe(false);
    const result = await testOnboardingCalculations(draft, { mass: 5 });
    expect(result.success).toBe(true);
  });

  it("rejects a template that does not parse and a dry run that throws", async () => {
    const invalid = await testOnboardingCalculations(
      { ...draft, labForm: { name: "Lab", questions: [{ id: 1 } as never] } },
      {},
    );
    expect(invalid.success).toBe(false);
    vi.mocked(evaluateCalculations).mockRejectedValue(new Error("down"));
    expect((await testOnboardingCalculations(draft, {})).success).toBe(false);
  });
});

describe("simpleReportLayout", () => {
  it("starts a new page once the lines run past the bottom", () => {
    const components = simpleReportLayout("Ash", Array.from({ length: 40 }, (_, i) => `row ${i}`));
    expect(components.some((component) => component.type === "pagebreak")).toBe(true);
  });
});
