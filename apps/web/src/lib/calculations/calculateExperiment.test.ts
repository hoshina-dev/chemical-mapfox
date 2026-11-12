import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: vi.fn() }));
vi.mock("@/app/actions/experiment", () => ({
  getCalculationInputsAction: vi.fn(),
  saveCalculationResultsAction: vi.fn(),
}));
vi.mock("./runner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./runner")>();
  return { ...actual, evaluateCalculations: vi.fn() };
});

import {
  getCalculationInputsAction,
  saveCalculationResultsAction,
} from "@/app/actions/experiment";

import { calculateExperiment } from "./calculateExperiment";
import { CalculationEngineError, evaluateCalculations } from "./runner";

const message = (error: CalculationEngineError) => `${error.code}:${error.message}`;
const report = {
  values: {},
  order: ["a"],
  calculations: { a: { formula: "1", status: "ok" as const, result: 1 } },
  missing_values: [],
  duplicate_question_ids: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCalculationInputsAction).mockResolvedValue({
    success: true,
    data: { experimentJson: "{}", fingerprint: "fp" },
  });
});

describe("calculateExperiment", () => {
  it("saves what the engine produced", async () => {
    vi.mocked(evaluateCalculations).mockResolvedValue({ report, valuesJson: "{}", calculationsJson: '{"a": 1}' });
    vi.mocked(saveCalculationResultsAction).mockResolvedValue({ success: true, data: null });
    await expect(calculateExperiment("ctx", message)).resolves.toEqual({ success: true, data: null });
    expect(saveCalculationResultsAction).toHaveBeenCalledWith("ctx", {
      fingerprint: "fp",
      valuesJson: "{}",
      calculationsJson: '{"a": 1}',
    });
  });

  it("returns a failed read as is", async () => {
    vi.mocked(getCalculationInputsAction).mockResolvedValue({ success: false, error: "nope" });
    await expect(calculateExperiment("ctx", message)).resolves.toEqual({ success: false, error: "nope" });
  });

  it("reports the first formula error without saving", async () => {
    vi.mocked(evaluateCalculations).mockResolvedValue({
      report: {
        ...report,
        calculations: { a: { formula: "1 / 0", status: "error", error: { kind: "zero_division", message: "Division by zero in 'a'" } } },
      },
      valuesJson: "{}",
      calculationsJson: "{}",
    });
    await expect(calculateExperiment("ctx", message)).resolves.toEqual({
      success: false,
      error: "Division by zero in 'a'",
    });
    expect(saveCalculationResultsAction).not.toHaveBeenCalled();
  });

  it("reports an engine failure", async () => {
    vi.mocked(evaluateCalculations).mockRejectedValue(new CalculationEngineError("timeout", "slow"));
    await expect(calculateExperiment("ctx", message)).resolves.toEqual({ success: false, error: "timeout:slow" });
  });

  it("refuses results too large for a Server Action before sending them", async () => {
    vi.mocked(evaluateCalculations).mockResolvedValue({
      report,
      valuesJson: "{}",
      calculationsJson: `{"a": {"formula": "x", "result": "${"é".repeat(450_000)}"}}`,
    });
    await expect(calculateExperiment("ctx", message)).resolves.toEqual({ success: false, error: "tooLarge:" });
    expect(saveCalculationResultsAction).not.toHaveBeenCalled();
  });

  it("turns a rejected action request into an error", async () => {
    vi.mocked(evaluateCalculations).mockResolvedValue({ report, valuesJson: "{}", calculationsJson: "{}" });
    vi.mocked(saveCalculationResultsAction).mockRejectedValue(new Error("Body exceeded 1 MB limit"));
    await expect(calculateExperiment("ctx", message)).resolves.toEqual({
      success: false,
      error: "save:Error: Body exceeded 1 MB limit",
    });
  });
});
