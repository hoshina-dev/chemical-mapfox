import type { ExperimentTemplate } from "@repo/forms";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/log/handled", () => ({ logHandledError: vi.fn() }));
vi.mock("@/lib/experiment-manager/client", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/experiment-manager/client")>()),
  createSampleType: vi.fn(),
  createTemplate: vi.fn(),
  getTemplate: vi.fn(),
  listSampleTypes: vi.fn(),
  setSampleTypeWebVisibility: vi.fn(),
  setTemplateWebVisibility: vi.fn(),
  updateTemplate: vi.fn(),
}));

import {
  createSampleType,
  createTemplate,
  type ExperimentTemplate as StoredTemplate,
  getTemplate,
  listSampleTypes,
  type SampleType,
  ExperimentManagerError,
  setSampleTypeWebVisibility,
  setTemplateWebVisibility,
  updateTemplate,
} from "@/lib/experiment-manager/client";

import { onboardTemplate, setCatalogueVisibility } from "./onboarding";

const template: ExperimentTemplate = {
  clientForm: { name: "Client", questions: [] },
  labForm: {
    name: "Lab",
    questions: [{ id: "mass", type: "number", label: "Mass" }],
  },
  calculations: { double: { formula: "values['mass'] * 2", result: 4 } },
};

const water = { id: "s-water", name: "Water" } as SampleType;
const saved = (id: string, sampleTypeId: string) =>
  ({ id, sampleTypeId }) as StoredTemplate;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listSampleTypes).mockResolvedValue([water]);
  vi.mocked(createTemplate).mockResolvedValue(saved("t-new", "s-water"));
});

describe("onboardTemplate", () => {
  it("reuses a sample matched by name (any case) and saves formulas without results", async () => {
    const result = await onboardTemplate("staff-ada", {
      sampleName: " water ",
      title: " pH ",
      template,
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        sampleId: "s-water",
        createdSample: false,
        templateId: "t-new",
        published: false,
      },
    });
    expect(createSampleType).not.toHaveBeenCalled();
    expect(createTemplate).toHaveBeenCalledWith("staff-ada", "s-water", {
      name: "pH",
      description: null,
      template: expect.objectContaining({
        calculations: { double: { formula: "values['mass'] * 2" } },
      }),
    });
  });

  it("creates the sample when the name is new", async () => {
    vi.mocked(createSampleType).mockResolvedValue({
      id: "s-coal",
      name: "Coal",
    } as SampleType);
    vi.mocked(createTemplate).mockResolvedValue(saved("t-new", "s-coal"));

    const result = await onboardTemplate("staff-ada", {
      sampleName: "Coal",
      title: "Ash",
      template,
    });
    expect(result).toMatchObject({
      success: true,
      data: { sampleId: "s-coal", createdSample: true },
    });
    expect(createSampleType).toHaveBeenCalledWith("staff-ada", {
      name: "Coal",
      description: null,
    });
  });

  it("saves nothing when a formula reads an unknown question", async () => {
    const result = await onboardTemplate("staff-ada", {
      sampleName: "Water",
      title: "pH",
      template: {
        ...template,
        calculations: { bad: { formula: "values['volume'] * 2" } },
      },
    });

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining("volume"),
    });
    expect(listSampleTypes).not.toHaveBeenCalled();
    expect(createTemplate).not.toHaveBeenCalled();
  });

  it("revises a template in place under its own sample", async () => {
    vi.mocked(updateTemplate).mockResolvedValue(saved("t-1", "s-water"));

    const result = await onboardTemplate("staff-ada", {
      templateId: "t-1",
      title: "pH v2",
      template,
    });
    expect(result).toMatchObject({
      success: true,
      data: { sampleId: "s-water", sampleName: "Water", templateId: "t-1" },
    });
    expect(updateTemplate).toHaveBeenCalledWith(
      "staff-ada",
      "t-1",
      expect.objectContaining({ name: "pH v2" }),
    );
    expect(createTemplate).not.toHaveBeenCalled();
  });

  it("shows the sample and the method only when asked, and keeps the save when that fails", async () => {
    vi.mocked(setTemplateWebVisibility).mockRejectedValue(
      new ExperimentManagerError("x", 409, "busy"),
    );

    const result = await onboardTemplate("staff-ada", {
      sampleId: "s-water",
      title: "pH",
      template,
      publish: true,
    });
    expect(setSampleTypeWebVisibility).toHaveBeenCalledWith(
      "staff-ada",
      "s-water",
      true,
    );
    expect(result).toMatchObject({
      success: true,
      data: {
        templateId: "t-new",
        published: false,
        warning: expect.stringContaining("busy"),
      },
    });
  });

  it("refuses an unknown sample id or no sample at all", async () => {
    expect(
      await onboardTemplate("staff-ada", {
        sampleId: "s-x",
        title: "pH",
        template,
      }),
    ).toMatchObject({
      success: false,
      error: "No sample with id s-x.",
    });
    expect(
      await onboardTemplate("staff-ada", { title: "pH", template }),
    ).toMatchObject({
      success: false,
      error: "Give sampleId or sampleName.",
    });
    expect(createTemplate).not.toHaveBeenCalled();
  });
});

describe("setCatalogueVisibility", () => {
  it("refuses a template that belongs to another sample", async () => {
    vi.mocked(getTemplate).mockResolvedValue(saved("t-1", "s-other"));

    const result = await setCatalogueVisibility(
      "staff-ada",
      "s-water",
      "t-1",
      true,
    );
    expect(result.success).toBe(false);
    expect(setTemplateWebVisibility).not.toHaveBeenCalled();
  });

  it("toggles the whole sample without a template id", async () => {
    const result = await setCatalogueVisibility(
      "staff-ada",
      "s-water",
      undefined,
      false,
    );
    expect(result.success).toBe(true);
    expect(setSampleTypeWebVisibility).toHaveBeenCalledWith(
      "staff-ada",
      "s-water",
      false,
    );
  });
});
