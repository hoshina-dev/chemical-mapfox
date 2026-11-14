import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CalculationDryRunResponse } from "@/lib/experiment-manager/client";

import type { SandboxCommand, SandboxReply } from "./protocol";

class FakeSandbox {
  static instances: FakeSandbox[] = [];
  posted: SandboxCommand[] = [];
  disposed = false;
  private listeners = new Set<(reply: SandboxReply) => void>();

  constructor() {
    FakeSandbox.instances.push(this);
  }
  post(command: SandboxCommand) {
    this.posted.push(command);
  }
  onReply(listener: (reply: SandboxReply) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  dispose() {
    this.disposed = true;
  }
  reply(reply: SandboxReply) {
    for (const listener of [...this.listeners]) listener(reply);
  }
  /** The id of the latest run command. */
  get jobId(): number {
    const job = this.posted.filter((c): c is { id: number; body: string } => "id" in c).at(-1);
    if (!job) throw new Error("no job posted");
    return job.id;
  }
}

vi.mock("./sandbox", () => ({ createSandbox: () => new FakeSandbox() }));

const report: CalculationDryRunResponse = {
  values: {},
  order: ["a"],
  calculations: { a: { formula: "1", status: "ok", result: 1 } },
  missing_values: [],
  duplicate_question_ids: [],
};
const out = JSON.stringify({ report, values: "{}", calculations: '{"a": 1.0}' });
const evaluation = { report, valuesJson: "{}", calculationsJson: '{"a": 1.0}' };

async function load() {
  vi.resetModules();
  return import("./runner");
}

function latest(): FakeSandbox {
  const sandbox = FakeSandbox.instances.at(-1);
  if (!sandbox) throw new Error("no sandbox");
  return sandbox;
}

async function posted(count = 1) {
  await vi.waitFor(() => expect(latest().posted.filter((c) => "id" in c)).toHaveLength(count));
  return latest();
}

beforeEach(() => {
  FakeSandbox.instances = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("evaluateCalculations", () => {
  it("creates the sandbox on first use and resolves with the parsed evaluation", async () => {
    const { evaluateCalculations } = await load();
    expect(FakeSandbox.instances).toHaveLength(0);

    const pending = evaluateCalculations({ calculations: {} });
    const sandbox = await posted();
    expect(sandbox.posted[0]).toEqual({ id: sandbox.jobId, body: '{"calculations":{}}' });

    sandbox.reply({ type: "booted" });
    sandbox.reply({ id: 999, type: "done", out });
    sandbox.reply({ id: sandbox.jobId, type: "started" });
    sandbox.reply({ id: sandbox.jobId, type: "done", out });
    await expect(pending).resolves.toEqual(evaluation);
  });

  it("passes JSON text through untouched", async () => {
    const { evaluateCalculations } = await load();
    const pending = evaluateCalculations('{"values":{"x":10.0}}');
    const sandbox = await posted();
    expect(sandbox.posted[0]).toMatchObject({ body: '{"values":{"x":10.0}}' });
    sandbox.reply({ id: sandbox.jobId, type: "done", out });
    await pending;
  });

  it("cancels a run after 5 s, however often it claims to have started", async () => {
    const { evaluateCalculations, CalculationEngineError } = await load();
    const caught = evaluateCalculations({ calculations: {} }).catch((error: unknown) => error);
    const sandbox = await posted();
    const id = sandbox.jobId;
    sandbox.reply({ id, type: "started" });
    await vi.advanceTimersByTimeAsync(4_000);
    sandbox.reply({ id, type: "started" });
    await vi.advanceTimersByTimeAsync(1_000);

    const error = await caught;
    expect(error).toBeInstanceOf(CalculationEngineError);
    expect(error).toMatchObject({ code: "timeout" });
    expect(sandbox.posted).toContainEqual({ cancel: id });
    expect(sandbox.disposed).toBe(false);
  });

  it("gives up loading after 60 s and starts a fresh sandbox next time", async () => {
    const { evaluateCalculations } = await load();
    const caught = evaluateCalculations({ calculations: {} }).catch((error: unknown) => error);
    const first = await posted();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await caught).toMatchObject({ code: "load", message: "Timed out loading Pyodide" });
    expect(first.disposed).toBe(true);

    const next = evaluateCalculations({ calculations: {} });
    await vi.waitFor(() => expect(FakeSandbox.instances).toHaveLength(2));
    const second = await posted();
    second.reply({ id: second.jobId, type: "done", out });
    await expect(next).resolves.toEqual(evaluation);
  });

  it("reports a worker that failed to start as a load error", async () => {
    const { evaluateCalculations } = await load();
    const caught = evaluateCalculations({ calculations: {} }).catch((error: unknown) => error);
    const sandbox = await posted();
    sandbox.reply({ id: sandbox.jobId, type: "error", code: "load", detail: "network down" });
    expect(await caught).toMatchObject({ code: "load", message: "network down" });
    expect(sandbox.disposed).toBe(true);
  });

  it("reports an engine error and keeps the sandbox", async () => {
    const { evaluateCalculations } = await load();
    const caught = evaluateCalculations({ calculations: {} }).catch((error: unknown) => error);
    const sandbox = await posted();
    sandbox.reply({ id: sandbox.jobId, type: "error", code: "engine", detail: "boom" });
    expect(await caught).toMatchObject({ code: "engine", message: "boom" });
    expect(sandbox.disposed).toBe(false);
    expect(sandbox.posted).toContainEqual({ cancel: sandbox.jobId });
  });

  it.each([
    ["not JSON", "nope"],
    ["missing the saved texts", JSON.stringify({ report })],
    ["without a report", JSON.stringify({ report: null, values: "{}", calculations: "{}" })],
    ["with a malformed report", JSON.stringify({ report: { calculations: {} }, values: "{}", calculations: "{}" })],
    [
      "with an error message that isn't text",
      JSON.stringify({
        report: {
          ...report,
          calculations: { a: { formula: "1", status: "error", error: { kind: "x", message: {} } } },
        },
        values: "{}",
        calculations: "{}",
      }),
    ],
    [
      "with an unknown status",
      JSON.stringify({
        report: { ...report, calculations: { a: { formula: "1", status: "pwned" } } },
        values: "{}",
        calculations: "{}",
      }),
    ],
  ])("rejects a reply that is %s", async (_, malformed) => {
    const { evaluateCalculations } = await load();
    const caught = evaluateCalculations({ calculations: {} }).catch((error: unknown) => error);
    const sandbox = await posted();
    sandbox.reply({ id: sandbox.jobId, type: "done", out: malformed });
    expect(await caught).toMatchObject({ code: "engine", message: "Malformed engine reply" });
  });

  it("runs one request at a time", async () => {
    const { evaluateCalculations } = await load();
    const first = evaluateCalculations({ calculations: {} });
    const second = evaluateCalculations({ calculations: {} });
    const sandbox = await posted();
    await vi.advanceTimersByTimeAsync(0);
    expect(sandbox.posted).toHaveLength(1);

    sandbox.reply({ id: sandbox.jobId, type: "done", out });
    await first;
    await posted(2);
    sandbox.reply({ id: sandbox.jobId, type: "done", out });
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
