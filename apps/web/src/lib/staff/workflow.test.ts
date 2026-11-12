import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));
vi.mock("@/lib/log/handled", () => ({ logHandledError: vi.fn(), levelForStatus: vi.fn() }));
vi.mock("@/lib/collab/room", () => ({ hydrate: vi.fn(), persistNow: vi.fn() }));
vi.mock("@/lib/ticketing/client", () => ({ ticketsApi: {} }));
vi.mock("@/lib/experiment-manager/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/experiment-manager/client")>();
  return {
    ...actual,
    getExperiment: vi.fn(),
    getExperimentJson: vi.fn(),
    updateExperiment: vi.fn(),
  };
});

import { revalidatePath } from "next/cache";

import {
  type ExperimentDetail,
  ExperimentManagerError,
  getExperiment,
  getExperimentJson,
  updateExperiment,
} from "@/lib/experiment-manager/client";

import { getCalculationInputs, saveCalculationResults } from "./workflow";

const forms = {
  clientForm: { name: "Client", questions: [] },
  labForm: { name: "Lab", questions: [{ id: "x", type: "number", label: "X" }] },
};

function stored(overrides: Partial<ExperimentDetail> = {}): ExperimentDetail {
  return {
    ...forms,
    calculations: { twice: { formula: "values['x'] * 2", result: "" } },
    values: { x: 10 },
    ...overrides,
  } as ExperimentDetail;
}

const input = {
  startedFrom: { x: 10 },
  valuesJson: '{"x": 10.0}',
  calculationsJson: '{"twice": {"formula": "values[\'x\'] * 2", "result": 20.0}}',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCalculationInputs", () => {
  it("returns the stored experiment as text, with its values", async () => {
    vi.mocked(getExperimentJson).mockResolvedValue('{"values":{"x":10.0},"calculations":{}}');
    await expect(getCalculationInputs("ctx")).resolves.toEqual({
      success: true,
      data: { experimentJson: '{"values":{"x":10.0},"calculations":{}}', values: { x: 10 } },
    });
  });

  it("defaults missing values to an empty object", async () => {
    vi.mocked(getExperimentJson).mockResolvedValue('{"values":null}');
    const res = await getCalculationInputs("ctx");
    expect(res.success && res.data.values).toEqual({});
  });

  it("reports a failed read", async () => {
    vi.mocked(getExperimentJson).mockRejectedValue(new Error("down"));
    await expect(getCalculationInputs("ctx")).resolves.toEqual({
      success: false,
      error: "Could not load this experiment's calculations.",
    });
  });
});

describe("saveCalculationResults", () => {
  it("PUTs the engine's text verbatim with the current forms", async () => {
    vi.mocked(getExperiment).mockResolvedValue(stored());
    vi.mocked(updateExperiment).mockResolvedValue(
      stored({ calculations: { twice: { formula: "values['x'] * 2", result: 20 } } }),
    );

    await expect(saveCalculationResults("ctx", input)).resolves.toEqual({ success: true, data: null });

    const [id, body] = vi.mocked(updateExperiment).mock.calls[0]!;
    expect(id).toBe("ctx");
    expect(body).toBe(
      `{"clientForm":${JSON.stringify(forms.clientForm)},"labForm":${JSON.stringify(forms.labForm)},"calculations":${input.calculationsJson},"values":${input.valuesJson}}`,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/internal/experiment/ctx");
  });

  it("refuses when the values changed after the browser read them", async () => {
    vi.mocked(getExperiment).mockResolvedValue(stored({ values: { x: 11 } }));
    await expect(saveCalculationResults("ctx", input)).resolves.toEqual({
      success: false,
      error: "The values or formulas changed while calculating. Calculate again.",
    });
    expect(updateExperiment).not.toHaveBeenCalled();
  });

  it("refuses when a formula changed after the browser read it", async () => {
    vi.mocked(getExperiment).mockResolvedValue(
      stored({ calculations: { twice: "values['x'] * 3" } }),
    );
    const res = await saveCalculationResults("ctx", input);
    expect(res.success).toBe(false);
    expect(updateExperiment).not.toHaveBeenCalled();
  });

  it("refuses when a formula failed, so its result is missing", async () => {
    vi.mocked(getExperiment).mockResolvedValue(
      stored({ calculations: { twice: { formula: "values['x'] * 2" }, bad: { formula: "1 / 0" } } }),
    );
    const res = await saveCalculationResults("ctx", input);
    expect(res.success).toBe(false);
    expect(updateExperiment).not.toHaveBeenCalled();
  });

  it("treats an experiment without values as empty", async () => {
    vi.mocked(getExperiment).mockResolvedValue(stored({ values: null, calculations: undefined }));
    vi.mocked(updateExperiment).mockResolvedValue(stored({ calculations: {} }));
    const res = await saveCalculationResults("ctx", {
      startedFrom: {},
      valuesJson: "{}",
      calculationsJson: "{}",
    });
    expect(res.success).toBe(true);
  });

  it.each([
    ["values", { ...input, valuesJson: "[1]" }],
    ["calculations", { ...input, calculationsJson: "not json" }],
    ["calculations", { ...input, calculationsJson: "null" }],
  ])("rejects malformed %s text without calling the backend", async (_, body) => {
    await expect(saveCalculationResults("ctx", body)).resolves.toEqual({
      success: false,
      error: "Could not save the calculation results.",
    });
    expect(getExperiment).not.toHaveBeenCalled();
  });

  it("asks for a rerun when a saved result is still empty", async () => {
    vi.mocked(getExperiment).mockResolvedValue(stored());
    vi.mocked(updateExperiment).mockResolvedValue(stored());
    const res = await saveCalculationResults("ctx", input);
    expect(res).toMatchObject({ success: false });
    expect(!res.success && res.error).toMatch(/didn't produce a result/);
  });

  it("surfaces the backend's error", async () => {
    vi.mocked(getExperiment).mockResolvedValue(stored());
    vi.mocked(updateExperiment).mockRejectedValue(
      new ExperimentManagerError("failed", 422, { detail: "Experiment context violates schema" }),
    );
    const res = await saveCalculationResults("ctx", input);
    expect(res.success).toBe(false);
  });
});
