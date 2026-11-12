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
  return { ...actual, getExperimentJson: vi.fn(), updateExperimentJson: vi.fn() };
});

import { revalidatePath } from "next/cache";

import { logHandledError } from "@/lib/log/handled";
import {
  ExperimentManagerError,
  getExperimentJson,
  updateExperimentJson,
} from "@/lib/experiment-manager/client";

import { getCalculationInputs, saveCalculationResults } from "./workflow";

// Forms as text: the default past 2^53 must reach the PUT unchanged.
const clientForm = '{"name":"Client","questions":[]}';
const labForm =
  '{"name":"Lab","questions":[{"id":"x","type":"number","label":"X"},{"id":"d","type":"number","label":"D","config":{"default":9007199254740993}},{"id":"g","type":"repeatable-group","label":"G","config":{"count":2,"questions":[{"id":"r","type":"number","label":"R","default":1.0}]}}]}';

/** Stored experiment text, as experiment-manager returns it. */
function storedJson(values = '{"x":10}', calculations = '{"twice":{"formula":"values[\'x\'] * 2","result":""}}') {
  return `{"clientForm":${clientForm},"labForm":${labForm},"calculations":${calculations},"values":${values}}`;
}

/** The saved experiment text the PUT answers with. */
function savedJson(result: string, calculations?: string) {
  return storedJson(
    undefined,
    calculations ?? `{"twice":{"formula":"values['x'] * 2","result":${result}}}`,
  );
}

async function inputsFor(text: string) {
  vi.mocked(getExperimentJson).mockResolvedValueOnce(text);
  const res = await getCalculationInputs("ctx");
  if (!res.success) throw new Error(res.error);
  return res.data;
}

const engineOutput = {
  valuesJson: '{"x": 10, "d": 9007199254740993, "r": [1.0, 1.0]}',
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

  it("PUTs the engine's text and the stored forms verbatim", async () => {
    vi.mocked(updateExperimentJson).mockResolvedValue(savedJson("20.0"));

    await expect(save()).resolves.toEqual({ success: true, data: null });

    expect(updateExperimentJson).toHaveBeenCalledWith(
      "ctx",
      `{"clientForm":${clientForm},"labForm":${labForm},"calculations":${engineOutput.calculationsJson},"values":${engineOutput.valuesJson}}`,
    );
    expect(revalidatePath).toHaveBeenCalledWith("/internal/experiment/ctx");
  });

  it("refuses when the values changed after the browser read them", async () => {
    await expect(save(storedJson('{"x":11}'))).resolves.toEqual({
      success: false,
      error: "calcInputsChanged",
    });
    expect(updateExperimentJson).not.toHaveBeenCalled();
  });

  it("refuses a change JSON.parse would not see", async () => {
    const res = await save(
      storedJson('{"x":9007199254740993}'),
      engineOutput,
      storedJson('{"x":9007199254740992}'),
    );
    expect(res).toEqual({ success: false, error: "calcInputsChanged" });
  });

  it.each([
    ["changes an answer", '{"x": 99, "d": 9007199254740993}'],
    ["changes a large answer by one", '{"x": 10, "big": 9007199254740992}'],
    ["adds an answer that has no default", '{"x": 10, "extra": 1}'],
    ["adds an inherited key", '{"x": 10, "constructor": 1}'],
    ["fills a default with another value", '{"x": 10, "d": 1}'],
    ["fills a repeatable default with the wrong count", '{"x": 10, "r": [1.0]}'],
    ["turns a string answer into a number", '{"x": 10, "big": 5}'],
  ])("refuses output that %s", async (_, valuesJson) => {
    const stored = valuesJson.includes('"big": 5')
      ? '{"x":10,"big":"#5"}'
      : valuesJson.includes("big")
        ? '{"x":10,"big":9007199254740993}'
        : '{"x":10}';
    const res = await save(storedJson(stored), { ...engineOutput, valuesJson }, storedJson(stored));
    expect(res).toEqual({ success: false, error: "calcSaveFailed" });
    expect(updateExperimentJson).not.toHaveBeenCalled();
  });

  it("refuses output for formulas other than the stored ones", async () => {
    const res = await save(storedJson(), {
      ...engineOutput,
      calculationsJson: '{"twice": {"formula": "1", "result": 1}}',
    });
    expect(res).toEqual({ success: false, error: "calcSaveFailed" });
    expect(updateExperimentJson).not.toHaveBeenCalled();
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

  it.each([
    ["kept its old result", savedJson("18")],
    ["changed a large result", savedJson("9007199254740992")],
    ["dropped the calculation", savedJson("", "{}")],
    ["kept a string that looks like the number", savedJson('"#20"')],
    ["kept a null calculation", savedJson("", '{"twice":null}')],
    ["stored a legacy string", savedJson("", '{"twice":"values[\'x\'] * 2"}')],
  ])("detects a backend that %s", async (_, response) => {
    vi.mocked(updateExperimentJson).mockResolvedValue(response);
    const output = _ === "changed a large result"
      ? { ...engineOutput, calculationsJson: '{"twice": {"formula": "values[\'x\'] * 2", "result": 9007199254740993}}' }
      : engineOutput;
    await expect(save(storedJson(), output)).resolves.toEqual({ success: false, error: "calcSaveFailed" });
    expect(logHandledError).toHaveBeenCalled();
  });

  it.each([
    ["-0.0 stored back as 0.0", "-0.0", "0.0"],
    ["1e20 stored back as an integer", "1e+20", "100000000000000000000"],
    ["a nested float list", "[1.5, [2.0]]", "[1.5, [2.0]]"],
    ["Avogadro-scale floats as exact decimals", "6.02214076e+23", "602214076000000000000000"],
    ["a float stored with trailing zeros", "1.5", "1.50"],
  ])("accepts %s", async (_, sent, stored) => {
    vi.mocked(updateExperimentJson).mockResolvedValue(savedJson(stored));
    const res = await save(storedJson(), {
      ...engineOutput,
      calculationsJson: `{"twice": {"formula": "values['x'] * 2", "result": ${sent}}}`,
    });
    expect(res).toEqual({ success: true, data: null });
  });

  it("asks for a rerun when a result is still empty", async () => {
    vi.mocked(updateExperimentJson).mockResolvedValue(savedJson("null"));
    const res = await save(storedJson(), {
      ...engineOutput,
      calculationsJson: '{"twice": {"formula": "values[\'x\'] * 2", "result": null}}',
    });
    expect(res).toEqual({ success: false, error: "calcNoResult" });
  });

  it("surfaces the backend's error", async () => {
    vi.mocked(updateExperimentJson).mockRejectedValue(
      new ExperimentManagerError("failed", 422, { detail: "Experiment context violates schema" }),
    );
    const res = await save();
    expect(res.success).toBe(false);
  });

  it("treats an experiment without forms or values as empty", async () => {
    vi.mocked(updateExperimentJson).mockResolvedValue('{"calculations":{},"values":{}}');
    const res = await save("{}", { valuesJson: "{}", calculationsJson: "{}" }, "{}");
    expect(res).toEqual({ success: true, data: null });
  });
});
