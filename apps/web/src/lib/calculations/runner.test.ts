import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CalculationDryRunResponse } from "@/lib/experiment-manager/client";

import type { WorkerReply, WorkerRequest } from "./protocol";

class FakeWorker {
  static instances: FakeWorker[] = [];
  posted: WorkerRequest[] = [];
  terminated = false;
  private listeners = { message: new Set<(e: MessageEvent) => void>(), error: new Set<(e: ErrorEvent) => void>() };

  constructor() {
    FakeWorker.instances.push(this);
  }
  addEventListener(type: "message" | "error", fn: never) {
    this.listeners[type].add(fn);
  }
  removeEventListener(type: "message" | "error", fn: never) {
    this.listeners[type].delete(fn);
  }
  postMessage(data: WorkerRequest) {
    this.posted.push(data);
  }
  terminate() {
    this.terminated = true;
  }
  reply(data: WorkerReply) {
    for (const fn of this.listeners.message) fn({ data } as MessageEvent);
  }
  fail(message: string) {
    for (const fn of this.listeners.error) fn({ message } as ErrorEvent);
  }
}

const report: CalculationDryRunResponse = {
  values: {},
  order: ["a"],
  calculations: { a: { formula: "1", status: "ok", result: 1 } },
  missing_values: [],
  duplicate_question_ids: [],
};
const evaluation = { report, valuesJson: "{}", calculationsJson: "{}" };

async function load() {
  vi.resetModules();
  return import("./runner");
}

function lastWorker(): FakeWorker {
  const worker = FakeWorker.instances.at(-1);
  if (!worker) throw new Error("no worker");
  return worker;
}

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("evaluateCalculations", () => {
  it("creates the worker on first use and resolves with its evaluation", async () => {
    const { evaluateCalculations } = await load();
    expect(FakeWorker.instances).toHaveLength(0);

    const pending = evaluateCalculations({ calculations: {} });
    await vi.waitFor(() => expect(lastWorker().posted).toHaveLength(1));
    const [request] = lastWorker().posted;
    expect(request?.body).toBe('{"calculations":{}}');

    lastWorker().reply({ id: 999, type: "done", evaluation: { ...evaluation, valuesJson: "x" } });
    lastWorker().reply({ id: request!.id, type: "started" });
    lastWorker().reply({ id: request!.id, type: "done", evaluation });
    await expect(pending).resolves.toEqual(evaluation);
  });

  it("passes JSON text through untouched", async () => {
    const { evaluateCalculations } = await load();
    const pending = evaluateCalculations('{"values":{"x":10.0}}');
    await vi.waitFor(() => expect(lastWorker().posted).toHaveLength(1));
    expect(lastWorker().posted[0]?.body).toBe('{"values":{"x":10.0}}');
    lastWorker().reply({ id: lastWorker().posted[0]!.id, type: "done", evaluation });
    await pending;
  });

  it("kills a run that exceeds 5 s and starts a fresh worker next time", async () => {
    const { evaluateCalculations, CalculationEngineError } = await load();
    const pending = evaluateCalculations({ calculations: {} });
    const caught = pending.catch((error: unknown) => error);
    await vi.waitFor(() => expect(lastWorker().posted).toHaveLength(1));
    const first = lastWorker();
    first.reply({ id: first.posted[0]!.id, type: "started" });

    await vi.advanceTimersByTimeAsync(4_999);
    expect(first.terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const error = await caught;
    expect(error).toBeInstanceOf(CalculationEngineError);
    expect(error).toMatchObject({ code: "timeout" });
    expect(first.terminated).toBe(true);

    const next = evaluateCalculations({ calculations: {} });
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    lastWorker().reply({ id: lastWorker().posted[0]!.id, type: "done", evaluation });
    await expect(next).resolves.toEqual(evaluation);
  });

  it("gives up loading after 60 s", async () => {
    const { evaluateCalculations } = await load();
    const caught = evaluateCalculations({ calculations: {} }).catch((error: unknown) => error);
    await vi.waitFor(() => expect(lastWorker().posted).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await caught).toMatchObject({ code: "load", message: "Timed out loading Pyodide" });
    expect(lastWorker().terminated).toBe(true);
  });

  it("reports a worker that fails to start as a load error", async () => {
    const { evaluateCalculations } = await load();
    const caught = evaluateCalculations({ calculations: {} }).catch((error: unknown) => error);
    await vi.waitFor(() => expect(lastWorker().posted).toHaveLength(1));
    lastWorker().fail("network down");
    expect(await caught).toMatchObject({ code: "load", message: "network down" });
  });

  it("keeps the worker after an engine error", async () => {
    const { evaluateCalculations } = await load();
    const caught = evaluateCalculations({ calculations: {} }).catch((error: unknown) => error);
    await vi.waitFor(() => expect(lastWorker().posted).toHaveLength(1));
    const worker = lastWorker();
    worker.reply({ id: worker.posted[0]!.id, type: "error", code: "engine", detail: "boom" });
    expect(await caught).toMatchObject({ code: "engine", message: "boom" });
    expect(worker.terminated).toBe(false);

    const next = evaluateCalculations({ calculations: {} });
    await vi.waitFor(() => expect(worker.posted).toHaveLength(2));
    expect(FakeWorker.instances).toHaveLength(1);
    worker.reply({ id: worker.posted[1]!.id, type: "done", evaluation });
    await next;
  });

  it("runs one request at a time", async () => {
    const { evaluateCalculations } = await load();
    const first = evaluateCalculations({ calculations: {} });
    const second = evaluateCalculations({ calculations: {} });
    await vi.waitFor(() => expect(lastWorker().posted).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(0);
    expect(lastWorker().posted).toHaveLength(1);

    lastWorker().reply({ id: lastWorker().posted[0]!.id, type: "done", evaluation });
    await first;
    await vi.waitFor(() => expect(lastWorker().posted).toHaveLength(2));
    lastWorker().reply({ id: lastWorker().posted[1]!.id, type: "done", evaluation });
    await second;
  });
});

describe("firstFailure", () => {
  const outcome = (status: "ok" | "error" | "skipped", error?: { kind: string; message: string }) => ({
    formula: "x",
    status,
    error: error ?? null,
  });

  it("is null when every formula succeeded", async () => {
    const { firstFailure } = await load();
    expect(firstFailure(report)).toBeNull();
  });

  it("prefers a cycle, as POST /calculate checks it first", async () => {
    const { firstFailure } = await load();
    expect(
      firstFailure({
        ...report,
        order: ["z"],
        calculations: {
          z: outcome("error", { kind: "zero_division", message: "Division by zero in 'z'" }),
          a: outcome("error", { kind: "circular", message: "Circular dependency among calculations: a, b" }),
        },
      }),
    ).toBe("Circular dependency among calculations: a, b");
  });

  it("returns the first failure in evaluation order", async () => {
    const { firstFailure } = await load();
    expect(
      firstFailure({
        ...report,
        order: ["ok", "second", "first"],
        calculations: {
          first: outcome("error", { kind: "runtime", message: "first" }),
          ok: outcome("ok"),
          second: outcome("error", { kind: "runtime", message: "second" }),
        },
      }),
    ).toBe("second");
  });

  it("falls back to the name when a failure has no message", async () => {
    const { firstFailure } = await load();
    expect(firstFailure({ ...report, order: ["a"], calculations: { a: outcome("skipped") } })).toBe("a");
  });
});
