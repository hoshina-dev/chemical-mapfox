import type { AnswerValue, ExperimentTemplate, Question } from "@repo/forms";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CalculationDryRunRequest,
  CalculationDryRunResponse,
} from "@/lib/calculations/types";

import { resolveDishRun } from "./dishRunResolve";

const dishes: Question = {
  id: "dishes",
  type: "repeatable-group",
  label: "Dish",
  config: {
    count: 8,
    itemLabel: "Dish",
    questions: [
      { id: "B", type: "number", label: "B" },
      { id: "C", type: "number", label: "C" },
    ],
  },
};

function template({
  dishRun = true,
  maxDishes = 8,
  group = "dishes",
  target = "G",
  decimals,
  finals,
}: {
  dishRun?: boolean;
  maxDishes?: number;
  group?: string;
  /** What the comparison is on — a calculation (`G`) or a measurement (`B`). */
  target?: string;
  decimals?: number;
  finals?: string[];
} = {}): ExperimentTemplate {
  return {
    clientForm: { name: "Client", questions: [] },
    labForm: {
      name: "Lab",
      questions: [dishes],
      ...(dishRun
        ? {
            dishRun: {
              group,
              maxDishes,
              ...(finals === undefined ? {} : { finals }),
              rules: [
                {
                  target,
                  label: target,
                  limit: { kind: "absolute" as const, value: 0.3 },
                  ...(decimals === undefined ? {} : { decimals }),
                },
              ],
            },
          }
        : {}),
    },
    calculations: { G: { formula: "…" } },
  };
}

/** The injected engine: records what it was asked, answers a canned report. */
const evaluate = vi.fn<(request: CalculationDryRunRequest) => Promise<CalculationDryRunResponse>>();

function engineReturns(
  result: unknown,
  status: "ok" | "error" | "skipped" = "ok",
  extra: Record<string, number> = {},
) {
  const response: CalculationDryRunResponse = {
    // The dry run echoes the answers back, which is where a measurement's
    // per-dish column comes from. These two agree within 0.3, so a comparison
    // on B behaves like one on an agreeing calculation.
    values: { B: [8.42, 8.55], C: [3, 4] },
    order: ["G"],
    calculations: {
      G: {
        formula: "…",
        status,
        ...(status === "ok" ? { result } : {}),
        ...(status === "error" ? { error: { kind: "runtime", message: "boom" } } : {}),
      },
      ...Object.fromEntries(
        Object.entries(extra).map(([name, value]) => [
          name,
          { formula: "…", status: "ok" as const, result: value },
        ]),
      ),
    },
    missing_values: [],
    duplicate_question_ids: [],
  };
  evaluate.mockResolvedValue(response);
}

/** `resolveDishRun` with the stub engine wired in. */
const resolve = (tpl: ExperimentTemplate, values: Record<string, AnswerValue>) =>
  resolveDishRun(tpl, values, evaluate);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveDishRun", () => {
  it("is INACTIVE for a method with no dish run, without calling the engine", async () => {
    const state = await resolve(template({ dishRun: false }), { B: [1, 2] });
    expect(state.phase).toBe("INACTIVE");
    // The regression that matters for every ordinary experiment: no Pyodide
    // download and no evaluation just because the lab form was opened.
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("accepts the first agreeing pair", async () => {
    engineReturns([8.42, 8.55]);
    const state = await resolve(template(), { B: [1, 2], C: [3, 4] });
    expect(state.phase).toBe("DONE");
    expect(state.acceptedPair).toEqual([1, 2]);
  });

  // The reported number is the engine's own `final_*` calculation, so the panel
  // and the PDF certificate can never show different figures.
  it("reads the reported value from the engine's final_* calculation", async () => {
    engineReturns([8.42, 8.55], "ok", { final_G: 8.49 });
    const state = await resolve(template({ finals: ["G"] }), { B: [1, 2] });
    expect(state.reported).toEqual([
      { target: "G", label: "G", calculation: "final_G", value: 8.49 },
    ]);
  });

  it("reports null while the engine has no value for a final yet", async () => {
    engineReturns([8.42, 8.9]);
    const state = await resolve(template({ finals: ["G"] }), { B: [1, 2] });
    expect(state.reported).toEqual([
      { target: "G", label: "G", calculation: "final_G", value: null },
    ]);
  });

  it("asks for another dish when the measured pair disagrees", async () => {
    engineReturns([8.42, 8.9]);
    const state = await resolve(template(), { B: [1, 2], C: [3, 4] });
    expect(state.phase).toBe("AWAITING_NEXT_DISH");
    expect(state.nextDish).toBe(3);
  });

  // The engine must see the normalized columns, or `zip` truncates and a dish
  // silently disappears.
  it("sends jointly normalized columns to the engine", async () => {
    engineReturns([null, null, 8.4]);
    await resolve(template(), { B: [null, null, 1.2] });
    const sent = evaluate.mock.calls[0]?.[0];
    expect(sent?.values?.B).toEqual([null, null, 1.2]);
    expect(sent?.values?.C).toEqual([null, null, null]);
  });

  it("reports a failed target as a config error carrying the engine message", async () => {
    engineReturns(undefined, "error");
    const state = await resolve(template(), { B: [1, 2], C: [3, 4] });
    expect(state.phase).toBe("CONFIG_ERROR");
    expect(state.issues[0]).toMatchObject({ code: "targetError", detail: "boom" });
  });

  // A skipped calculation means a missing measurement upstream, not a template
  // bug — it must never read as "no pair agrees".
  it("treats a skipped target as unmeasured, not as an error", async () => {
    engineReturns(undefined, "skipped");
    const state = await resolve(template(), { B: [1, 2], C: [3, 4] });
    expect(state.phase).toBe("AWAITING_DISHES");
  });

  // Comparing two dishes' raw readings is a legitimate method, and the builder
  // offers measurements alongside calculations. A measurement's series is its
  // answer column, not an entry in `calculations` — reading only the latter
  // reported the method as broken.
  it("compares a measurement by reading its answer column", async () => {
    engineReturns([8.42, 8.9]);
    const state = await resolve(template({ target: "B" }), { B: [1, 2] });
    expect(state.issues).toEqual([]);
    expect(state.phase).toBe("DONE");
    expect(state.acceptedPair).toEqual([1, 2]);
  });

  it("still reports a target that is neither a measurement nor a calculation", async () => {
    engineReturns([8.42, 8.55]);
    const state = await resolve(template({ target: "nope" }), { B: [1, 2] });
    expect(state.phase).toBe("CONFIG_ERROR");
    expect(state.issues[0]).toMatchObject({ code: "targetMissing", target: "nope" });
  });

  it("rejects a dish run allowing more dishes than the group repeats", async () => {
    const state = await resolve(template({ maxDishes: 12 }), { B: [1, 2] });
    expect(state.phase).toBe("CONFIG_ERROR");
    expect(state.issues[0]).toMatchObject({
      code: "maxDishesAboveCount",
      expected: 8,
      actual: 12,
    });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("rejects a dish run naming a group that is not in the lab form", async () => {
    const state = await resolve(template({ group: "absent" }), { B: [1, 2] });
    expect(state.phase).toBe("CONFIG_ERROR");
    expect(state.issues[0]?.code).toBe("groupMissing");
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("applies the rule's rounding to the comparison", async () => {
    engineReturns([8.42, 8.9, 8.6]);
    const raw = await resolve(template(), { B: [1, 2, 3] });
    const rounded = await resolve(template({ decimals: 2 }), { B: [1, 2, 3] });
    // Dishes 2 and 3 differ by exactly 0.30 on paper but 0.3000000000000007 in
    // floating point, so only the rounded comparison admits that pair.
    const pair = (s: typeof raw) => s.pairs.find((p) => p.a === 2 && p.b === 3)?.accepted;
    expect(pair(raw)).toBe(false);
    expect(pair(rounded)).toBe(true);
  });
});
