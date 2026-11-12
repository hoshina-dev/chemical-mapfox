import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("@/lib/log/handled", () => ({ logHandledError: vi.fn(), levelForStatus: vi.fn() }));
vi.mock("@/lib/collab/room", () => ({ hydrate: vi.fn(), persistNow: vi.fn() }));
vi.mock("@/lib/ticketing/client", () => ({ ticketsApi: {} }));
vi.mock("@/lib/experiment-manager/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/experiment-manager/client")>();
  return { ...actual, getExperimentJson: vi.fn(), updateExperiment: vi.fn() };
});

import { revalidatePath } from "next/cache";

import { logHandledError } from "@/lib/log/handled";
import {
  type ExperimentDetail,
  ExperimentManagerError,
  getExperimentJson,
  updateExperiment,
} from "@/lib/experiment-manager/client";

import { getCalculationInputs, saveCalculationResults } from "./workflow";

const forms = {
  clientForm: { name: "Client", questions: [] },
  labForm: { name: "Lab", questions: [{ id: "x", type: "number", label: "X" }] },
};

/** Stored experiment text, as experiment-manager returns it. */
function storedJson(values = '{"x":10}', calculations = '{"twice":{"formula":"values[\'x\'] * 2","result":""}}') {
  return `{"clientForm":${JSON.stringify(forms.clientForm)},"labForm":${JSON.stringify(forms.labForm)},"calculations":${calculations},"values":${values}}`;
}

function savedDetail(result: unknown, extra: Record<string, unknown> = {}): ExperimentDetail {
  return {
    ...forms,
    calculations: { twice: { formula: "values['x'] * 2", result }, ...extra },
    values: { x: 10 },
  } as ExperimentDetail;
}

async function inputsFor(text: string) {
  vi.mocked(getExperimentJson).mockResolvedValueOnce(text);
  const res = await getCalculationInputs("ctx");
  if (!res.success) throw new Error(res.error);
  return res.data;
}

const engineOutput = {
  valuesJson: '{"x": 10, "d": 4.0}',
  calculationsJson: '{"twice": {"formula": "values[\'x\'] * 2", "result": 20.0}}',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCalculationInputs", () => {
  it("returns the stored experiment as text with a fingerprint of its inputs", async () => {
    const data = await inputsFor(storedJson());
    expect(data.experimentJson).toBe(storedJson());
    expect(data.fingerprint).toEqual(expect.any(String));
  });

  it("tells 10 from 10.0 and integers past 2^53 apart", async () => {
    const a = await inputsFor(storedJson('{"x":10}'));
    const b = await inputsFor(storedJson('{"x":10.0}'));
    const c = await inputsFor(storedJson('{"x":9007199254740992}'));
    const d = await inputsFor(storedJson('{"x":9007199254740993}'));
    expect(a.fingerprint).not.toBe(b.fingerprint);
    expect(c.fingerprint).not.toBe(d.fingerprint);
  });

  it("covers formulas, including legacy string ones", async () => {
    const a = await inputsFor(storedJson(undefined, '{"twice":"values[\'x\'] * 2"}'));
    const b = await inputsFor(storedJson(undefined, '{"twice":"values[\'x\'] * 3"}'));
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("handles an experiment with no values or calculations", async () => {
    await expect(inputsFor("{}")).resolves.toMatchObject({ experimentJson: "{}" });
  });

  it("reports a failed read", async () => {
    vi.mocked(getExperimentJson).mockRejectedValue(new Error("down"));
    await expect(getCalculationInputs("ctx")).resolves.toEqual({
      success: false,
      error: "calcLoadFailed",
    });
  });
});

describe("saveCalculationResults", () => {
  async function save(storedNow = storedJson(), output = engineOutput, readAt = storedJson()) {
    const { fingerprint } = await inputsFor(readAt);
    vi.mocked(getExperimentJson).mockResolvedValueOnce(storedNow);
    return saveCalculationResults("ctx", { fingerprint, ...output });
  }

  it("PUTs the engine's text verbatim with the current forms", async () => {
    vi.mocked(updateExperiment).mockResolvedValue(savedDetail(20));

    await expect(save()).resolves.toEqual({ success: true, data: null });

    expect(updateExperiment).toHaveBeenCalledWith(
      "ctx",
      `{"clientForm":${JSON.stringify(forms.clientForm)},"labForm":${JSON.stringify(forms.labForm)},"calculations":${engineOutput.calculationsJson},"values":${engineOutput.valuesJson}}`,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/internal/experiment/ctx");
  });

  it("refuses when the values changed after the browser read them", async () => {
    await expect(save(storedJson('{"x":11}'))).resolves.toEqual({
      success: false,
      error: "calcInputsChanged",
    });
    expect(updateExperiment).not.toHaveBeenCalled();
  });

  it("refuses a change JSON.parse would not see", async () => {
    const res = await save(
      storedJson('{"x":9007199254740993}'),
      engineOutput,
      storedJson('{"x":9007199254740992}'),
    );
    expect(res).toEqual({ success: false, error: "calcInputsChanged" });
  });

  it("refuses output that changes an answer instead of only adding defaults", async () => {
    const res = await save(storedJson(), { ...engineOutput, valuesJson: '{"x": 99}' });
    expect(res).toEqual({ success: false, error: "calcSaveFailed" });
    expect(updateExperiment).not.toHaveBeenCalled();
  });

  it("refuses output for formulas other than the stored ones", async () => {
    const res = await save(storedJson(), {
      ...engineOutput,
      calculationsJson: '{"twice": {"formula": "1", "result": 1}}',
    });
    expect(res).toEqual({ success: false, error: "calcSaveFailed" });
    expect(updateExperiment).not.toHaveBeenCalled();
  });

  it.each([
    ["values", { ...engineOutput, valuesJson: "[1]" }],
    ["calculations", { ...engineOutput, calculationsJson: "not json" }],
    ["calculations", { ...engineOutput, calculationsJson: "null" }],
  ])("rejects malformed %s text without calling the backend", async (_, output) => {
    await expect(saveCalculationResults("ctx", { fingerprint: "f", ...output })).resolves.toEqual({
      success: false,
      error: "calcSaveFailed",
    });
    expect(getExperimentJson).not.toHaveBeenCalled();
  });

  it("detects a backend that kept its old results", async () => {
    vi.mocked(updateExperiment).mockResolvedValue(savedDetail(18));
    await expect(save()).resolves.toEqual({ success: false, error: "calcSaveFailed" });
    expect(logHandledError).toHaveBeenCalled();
  });

  it("detects a calculation the backend did not return", async () => {
    vi.mocked(updateExperiment).mockResolvedValue({ ...savedDetail(20), calculations: {} } as ExperimentDetail);
    await expect(save()).resolves.toEqual({ success: false, error: "calcSaveFailed" });
  });

  it("accepts -0.0 stored back as 0.0", async () => {
    vi.mocked(updateExperiment).mockResolvedValue(savedDetail(0));
    const res = await save(storedJson(), {
      ...engineOutput,
      calculationsJson: '{"twice": {"formula": "values[\'x\'] * 2", "result": -0.0}}',
    });
    expect(res).toEqual({ success: true, data: null });
  });

  it("asks for a rerun when a result is still empty", async () => {
    vi.mocked(updateExperiment).mockResolvedValue(savedDetail(null));
    const res = await save(storedJson(), {
      ...engineOutput,
      calculationsJson: '{"twice": {"formula": "values[\'x\'] * 2", "result": null}}',
    });
    expect(res).toEqual({ success: false, error: "calcNoResult" });
  });

  it("surfaces the backend's error", async () => {
    vi.mocked(updateExperiment).mockRejectedValue(
      new ExperimentManagerError("failed", 422, { detail: "Experiment context violates schema" }),
    );
    const res = await save();
    expect(res.success).toBe(false);
  });

  it("treats an experiment without values as empty", async () => {
    vi.mocked(updateExperiment).mockResolvedValue({ ...forms, calculations: {}, values: {} } as ExperimentDetail);
    const res = await save("{}", { valuesJson: "{}", calculationsJson: "{}" }, "{}");
    expect(res).toEqual({ success: true, data: null });
  });
});
