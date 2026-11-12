import { loadPyodide } from "pyodide";
import { beforeAll, describe, expect, it } from "vitest";

import type { CalculationDryRunResponse } from "@/lib/experiment-manager/client";

import { ENGINE_SOURCE } from "./engineSource";

// Expected outputs were captured from experiment-manager's
// POST /api/calculations/evaluate for the same bodies.

interface EngineOutput {
  report: CalculationDryRunResponse;
  values: string;
  calculations: string;
}

let dryRunJson: (body: string) => string;

beforeAll(async () => {
  const pyodide = await loadPyodide();
  pyodide.runPython(ENGINE_SOURCE);
  dryRunJson = pyodide.globals.get("dry_run_json");
}, 60_000);

function run(body: unknown): EngineOutput {
  return JSON.parse(dryRunJson(typeof body === "string" ? body : JSON.stringify(body)));
}

const labForm = {
  name: "Lab",
  questions: [
    {
      id: "g",
      type: "repeatable-group",
      label: "G",
      config: {
        count: 3,
        questions: [{ id: "r", type: "number", label: "R", config: { default: 2 } }],
      },
    },
    { id: "d", type: "number", label: "D", config: { default: 4 } },
    { id: "plain", type: "number", label: "P", default: 7 },
  ],
};

function draft(calculations: Record<string, string>, values: Record<string, unknown> = {}) {
  return {
    clientForm: { name: "Client", questions: [] },
    labForm,
    calculations: Object.fromEntries(
      Object.entries(calculations).map(([name, formula]) => [name, { formula }]),
    ),
    values,
  };
}

function outcomes(body: unknown) {
  return run(body).report.calculations;
}

describe("calculation engine", () => {
  it("runs on CPython 3.12, like the backend", () => {
    const py = outcomes(draft({ comp: "[v * 2 for v in values['r']]" }));
    // Reading `values` inside a comprehension needs PEP 709 inlining (3.12+).
    expect(py.comp).toMatchObject({ status: "ok", result: [4, 4, 4] });
  });

  it("evaluates in dependency order, not declaration order", () => {
    const { report } = run(draft({ scaled: "base * 10", base: "2 + 3" }));
    expect(report.order).toEqual(["base", "scaled"]);
    expect(Object.keys(report.calculations)).toEqual(["scaled", "base"]);
    expect(report.calculations.scaled).toMatchObject({ status: "ok", result: 50 });
  });

  it("fills question defaults and coerces numeric strings", () => {
    const { report } = run(
      draft(
        { sum_r: "sum(values['r'])", d2: "values['d'] * 2", s: "values['s'] * 2", f: "values['f'] + 1", p: "values['plain']" },
        { s: "21", f: "1.5" },
      ),
    );
    expect(report.values).toEqual({ s: 21, f: 1.5, r: [2, 2, 2], d: 4, plain: 7 });
    expect(report.calculations.sum_r?.result).toBe(6);
    expect(report.calculations.d2?.result).toBe(8);
    expect(report.calculations.s?.result).toBe(42);
    expect(report.calculations.f?.result).toBe(2.5);
    expect(report.calculations.p?.result).toBe(7);
  });

  it("reports each failure kind with the backend's message", () => {
    const calcs = outcomes(
      draft({
        zero: "1 / 0",
        undef: "foo + 1",
        missing: "values['nope']",
        syntax: "1 +",
        dunder: "values.__class__",
        runtime: "stdev([1])",
        inf: "1e308 * 10",
        imp: "import os",
      }),
    );
    expect(calcs.zero?.error).toEqual({ kind: "zero_division", message: "Division by zero in 'zero'", names: [] });
    expect(calcs.undef?.error).toEqual({
      kind: "undefined_name",
      message: "Undefined variable in 'undef': name 'foo' is not defined",
      names: ["foo"],
    });
    expect(calcs.missing?.error).toEqual({
      kind: "missing_value",
      message: "Missing value in 'missing': no answer for 'nope'",
      names: ["nope"],
    });
    expect(calcs.syntax?.error?.message).toBe("Calculation error in 'syntax': invalid syntax (<unknown>, line 1)");
    expect(calcs.dunder?.error?.message).toBe("Invalid expression in 'dunder': dunder access not allowed");
    expect(calcs.runtime?.error?.message).toBe("Calculation error in 'runtime': stdev requires at least two data points");
    expect(calcs.inf?.error).toMatchObject({ kind: "non_finite", message: "Non-finite result in 'inf' (got inf)" });
    expect(calcs.imp?.error?.message).toBe("Calculation error in 'imp': __import__ not found");
  });

  it("skips formulas that depend on a failure and lists missing answers", () => {
    const { report } = run(draft({ broken: "values['nope'] + 1", downstream: "broken * 2" }));
    expect(report.calculations.downstream).toMatchObject({
      status: "skipped",
      error: {
        kind: "dependency_failed",
        message: "Not evaluated — depends on broken, which did not produce a result",
        names: ["broken"],
      },
    });
    expect(report.missing_values).toEqual(["nope"]);
  });

  it("reports a cycle against every member", () => {
    const calcs = outcomes(draft({ a: "b + 1", b: "a + 1" }));
    expect(calcs.a?.error).toEqual({
      kind: "circular",
      message: "Circular dependency among calculations: a, b",
      names: ["b"],
    });
    expect(calcs.b?.error?.names).toEqual(["a"]);
  });

  it("supports multi-line formulas and an assigned result", () => {
    const calcs = outcomes(
      draft({ last: "x = values['d'] * 2\nx + 1", assigned: "x = 3\nresult = x * 2", none: "x = 3" }),
    );
    expect(calcs.last?.result).toBe(9);
    expect(calcs.assigned?.result).toBe(6);
    expect(calcs.none).toMatchObject({ status: "ok", result: null });
  });

  it("serializes results the way the backend's pydantic does", () => {
    const calcs = outcomes(
      draft({
        tuple: "(1, 2)",
        set: "{1, 2}",
        zip: "zip([1], [2])",
        intKey: "{1: 2}",
        boolKey: "{True: 3}",
        nested: "{'a': (1, 2), 'b': {3}}",
        bytes: "b'ab'",
        complex: "1+2j",
        module: "math",
      }),
    );
    expect(calcs.tuple?.result).toEqual([1, 2]);
    expect(calcs.set?.result).toEqual([1, 2]);
    expect(calcs.zip?.result).toEqual([[1, 2]]);
    expect(calcs.intKey?.result).toEqual({ "1": 2 });
    expect(calcs.boolKey?.result).toEqual({ true: 3 });
    expect(calcs.nested?.result).toEqual({ a: [1, 2], b: [3] });
    expect(calcs.bytes?.result).toBe("ab");
    expect(calcs.complex?.result).toBe("1+2j");
    // The backend fails the whole request here; the engine blames the formula.
    expect(calcs.module).toMatchObject({
      status: "error",
      error: { kind: "runtime", message: "Calculation error in 'module': a module result can't be saved" },
    });
  });

  it("reports a non-finite answer as null instead of failing the run", () => {
    const { report } = run(draft({ ok: "values['d'] * 2" }, { note: "NaN", far: ["inf", "1"] }));
    expect(report.values).toMatchObject({ note: null, far: [null, 1] });
    expect(report.calculations.ok?.result).toBe(8);
  });

  it("does not let one run's formula change math for the next", () => {
    run(draft({ tamper: "math.pi = 3\nmath.extra = 1\n1" }));
    const calcs = outcomes(draft({ pi: "math.pi", extra: "math.extra" }));
    expect(calcs.pi?.result).toBe(Math.PI);
    expect(calcs.extra?.error?.message).toBe(
      "Calculation error in 'extra': module 'math' has no attribute 'extra'",
    );
  });

  it("reports question ids used more than once", () => {
    const { report } = run({
      clientForm: { name: "C", questions: [{ id: "a", type: "number", label: "A" }] },
      labForm: { name: "L", questions: [{ id: "a", type: "number", label: "A" }] },
      calculations: { x: { formula: "values['a']" } },
      values: { a: 3 },
    });
    expect(report.duplicate_question_ids).toEqual(["a"]);
  });

  it("reads a stored experiment and keeps Python's floats in what it saves", () => {
    const stored = `{"id":"e1","clientForm":{"name":"C","questions":[]},"labForm":${JSON.stringify(labForm)},"calculations":{"twice":{"formula":"values['x'] * 2","result":""},"bad":"1 / 0"},"values":{"x":10.0}}`;
    const out = run(stored);
    expect(out.values).toBe('{"x": 10.0, "r": [2, 2, 2], "d": 4, "plain": 7}');
    expect(out.calculations).toBe('{"twice": {"formula": "values[\'x\'] * 2", "result": 20.0}}');
  });
});
