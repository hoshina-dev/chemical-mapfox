import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis/client", async () => {
  const { default: RedisMock } = await import("ioredis-mock");
  const redis = new RedisMock();
  return { getRedis: () => redis, getSubscriber: () => redis };
});
vi.mock("@/lib/experiment-manager/client", () => ({
  getExperiment: vi.fn(),
  updateExperiment: vi.fn(),
  ExperimentManagerError: class ExperimentManagerError extends Error {},
}));
vi.mock("@/lib/ticketing/client", () => ({
  ticketsApi: { apiV1TicketsIdGet: vi.fn() },
}));
vi.mock("@/lib/staff/workflow", () => ({
  updateFinalizingValues: vi.fn(),
}));
vi.mock("@/lib/log/handled", () => ({ logHandledError: vi.fn() }));
vi.mock("@/lib/collab/room", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/collab/room")>();
  return { ...actual, scheduleFlush: vi.fn() };
});

import { getExperiment, updateExperiment } from "@/lib/experiment-manager/client";
import { logHandledError } from "@/lib/log/handled";
import { getRedis } from "@/lib/redis/client";
import * as room from "@/lib/collab/room";
import { ticketsApi } from "@/lib/ticketing/client";
import { updateFinalizingValues } from "@/lib/staff/workflow";

import { recordLabValues } from "./labValues";

const ctx = "ctx-lab";
const conn = "mcp:grant-1";

const labForm = {
  name: "Lab",
  questions: [
    {
      id: "ph",
      type: "number" as const,
      label: "pH",
      config: { min: 0, max: 14 },
    },
    {
      id: "note",
      type: "string" as const,
      label: "Note",
      required: true,
      config: { minLength: 2, maxLength: 40 },
    },
    {
      id: "blanks",
      type: "repeatable-group" as const,
      label: "Blanks",
      config: {
        count: 1,
        questions: [{ id: "blank_note", type: "string" as const, label: "Blank" }],
      },
    },
    {
      id: "measurements",
      type: "repeatable-group" as const,
      label: "Measurements",
      config: {
        count: 2,
        questions: [
          {
            id: "reading_a",
            type: "number" as const,
            label: "Reading A",
            config: { min: 0, max: 10 },
          },
        ],
      },
    },
  ],
};

const detail = {
  id: ctx,
  sample_id: "s1",
  template_id: "t1",
  clientForm: { name: "Client", questions: [] },
  labForm,
  calculations: {},
  values: { ph: 7, note: "ok" },
  created_at: "2026-01-01T00:00:00Z",
  report_status: null,
};

async function asExperimenting() {
  vi.mocked(ticketsApi.apiV1TicketsIdGet).mockResolvedValue({
    status: "EXPERIMENTING",
  } as never);
}

beforeEach(async () => {
  await getRedis().flushall();
  vi.mocked(getExperiment).mockReset().mockResolvedValue(detail as never);
  vi.mocked(updateExperiment).mockReset().mockResolvedValue({} as never);
  vi.mocked(ticketsApi.apiV1TicketsIdGet).mockReset();
  vi.mocked(updateFinalizingValues).mockReset().mockResolvedValue({
    success: true,
    data: null,
  });
  vi.mocked(logHandledError).mockReset();
  vi.mocked(room.scheduleFlush).mockReset();
});

describe("recordLabValues — ticket stage", () => {
  it("fails when the ticket cannot be loaded", async () => {
    const err = new Error("ticketing down");
    vi.mocked(ticketsApi.apiV1TicketsIdGet).mockRejectedValue(err);

    await expect(recordLabValues(ctx, { ph: 8 }, conn)).resolves.toEqual({
      success: false,
      error: "Could not load this experiment's ticket.",
    });
    expect(logHandledError).toHaveBeenCalledWith(err, {
      op: "mcp.recordLabValues.ticket",
      contextId: ctx,
    });
    expect(updateFinalizingValues).not.toHaveBeenCalled();
    expect(updateExperiment).not.toHaveBeenCalled();
  });

  it("merges FINALIZING values, treating null as a delete", async () => {
    vi.mocked(ticketsApi.apiV1TicketsIdGet).mockResolvedValue({
      status: "FINALIZING",
    } as never);

    await expect(
      recordLabValues(ctx, { ph: null, note: "fixed" }, conn),
    ).resolves.toEqual({
      success: true,
      data: { stage: "FINALIZING", saved: ["ph", "note"] },
    });
    expect(updateFinalizingValues).toHaveBeenCalledWith(ctx, { note: "fixed" });
    expect(updateExperiment).not.toHaveBeenCalled();
  });

  it("starts from an empty bag when the FINALIZING experiment has no values", async () => {
    vi.mocked(ticketsApi.apiV1TicketsIdGet).mockResolvedValue({
      status: "FINALIZING",
    } as never);
    vi.mocked(getExperiment).mockResolvedValue({
      ...detail,
      values: undefined,
    } as never);

    await expect(recordLabValues(ctx, { ph: 6.5 }, conn)).resolves.toMatchObject({
      success: true,
      data: { stage: "FINALIZING", saved: ["ph"] },
    });
    expect(updateFinalizingValues).toHaveBeenCalledWith(ctx, { ph: 6.5 });
  });

  it("passes through a FINALIZING write failure", async () => {
    vi.mocked(ticketsApi.apiV1TicketsIdGet).mockResolvedValue({
      status: "FINALIZING",
    } as never);
    vi.mocked(updateFinalizingValues).mockResolvedValue({
      success: false,
      error: "This can only be fixed while the ticket is in the Finalizing stage.",
    });

    await expect(recordLabValues(ctx, { ph: 6 }, conn)).resolves.toEqual({
      success: false,
      error: "This can only be fixed while the ticket is in the Finalizing stage.",
    });
  });

  it("fails when the FINALIZING experiment cannot be loaded", async () => {
    vi.mocked(ticketsApi.apiV1TicketsIdGet).mockResolvedValue({
      status: "FINALIZING",
    } as never);
    const err = new Error("em down");
    vi.mocked(getExperiment).mockRejectedValue(err);

    await expect(recordLabValues(ctx, { ph: 6 }, conn)).resolves.toEqual({
      success: false,
      error: "Could not load the experiment's current values.",
    });
    expect(logHandledError).toHaveBeenCalledWith(err, {
      op: "mcp.recordLabValues.finalizing",
      contextId: ctx,
    });
  });

  it("fails when the FINALIZING write throws", async () => {
    vi.mocked(ticketsApi.apiV1TicketsIdGet).mockResolvedValue({
      status: "FINALIZING",
    } as never);
    const err = new Error("write failed");
    vi.mocked(updateFinalizingValues).mockRejectedValue(err);

    await expect(recordLabValues(ctx, { ph: 6 }, conn)).resolves.toEqual({
      success: false,
      error: "Could not load the experiment's current values.",
    });
    expect(logHandledError).toHaveBeenCalledWith(err, {
      op: "mcp.recordLabValues.finalizing",
      contextId: ctx,
    });
  });

  it("refuses stages other than EXPERIMENTING or FINALIZING", async () => {
    vi.mocked(ticketsApi.apiV1TicketsIdGet).mockResolvedValue({
      status: "PENDING",
    } as never);

    await expect(recordLabValues(ctx, { ph: 8 }, conn)).resolves.toEqual({
      success: false,
      error:
        "Lab values can only be recorded while the experiment is EXPERIMENTING or FINALIZING (it is PENDING).",
    });
  });

  it("describes a missing ticket status as unknown", async () => {
    vi.mocked(ticketsApi.apiV1TicketsIdGet).mockResolvedValue({} as never);

    await expect(recordLabValues(ctx, { ph: 8 }, conn)).resolves.toEqual({
      success: false,
      error:
        "Lab values can only be recorded while the experiment is EXPERIMENTING or FINALIZING (it is unknown).",
    });
  });
});

describe("recordLabValues — EXPERIMENTING", () => {
  it("fails when hydrate cannot load the lab form", async () => {
    await asExperimenting();
    const err = new Error("no context");
    vi.mocked(getExperiment).mockRejectedValue(err);

    await expect(recordLabValues(ctx, { ph: 8 }, conn)).resolves.toEqual({
      success: false,
      error: "Could not load the experiment's lab form.",
    });
    expect(logHandledError).toHaveBeenCalledWith(err, {
      op: "mcp.recordLabValues.hydrate",
      contextId: ctx,
    });
  });

  it("fails when the room has no template after hydrate", async () => {
    await asExperimenting();
    await getRedis().set(`template:${ctx}`, "null");

    await expect(recordLabValues(ctx, { ph: 8 }, conn)).resolves.toEqual({
      success: false,
      error: "Could not load the experiment's lab form.",
    });
    expect(getExperiment).not.toHaveBeenCalled();
  });

  it("refuses an unknown field without writing anything", async () => {
    await asExperimenting();

    await expect(
      recordLabValues(ctx, { stray: 1, ph: 8 }, conn),
    ).resolves.toEqual({
      success: false,
      error: "Nothing was saved.\nstray: not a question in this lab form.",
    });
    expect(await room.readValues(ctx)).toEqual({ ph: 7, note: "ok" });
    expect(updateExperiment).not.toHaveBeenCalled();
  });

  it("refuses an invalid value using the real submit-mode validator", async () => {
    await asExperimenting();

    const result = await recordLabValues(ctx, { ph: 15 }, conn);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toContain("Nothing was saved.");
    expect(result.error).toContain("ph:");
    expect(result.error).toContain("at most 14");
    expect(await room.readValues(ctx)).toEqual({ ph: 7, note: "ok" });
  });

  it("ignores required-field issues so a partial update can clear a required answer", async () => {
    await asExperimenting();

    await expect(recordLabValues(ctx, { note: null }, conn)).resolves.toEqual({
      success: true,
      data: { stage: "EXPERIMENTING", saved: ["note"] },
    });
    expect(await room.readValues(ctx)).toEqual({ ph: 7 });
  });

  it("refuses a field locked by a named colleague, all-or-nothing", async () => {
    await asExperimenting();
    await room.hydrate(ctx);
    await room.setPresence(ctx, {
      connectionId: "conn-ada",
      userId: "ada",
      name: "Ada",
      color: "grape",
    });
    await room.acquireLock(ctx, "ph", "conn-ada");

    const result = await recordLabValues(ctx, { ph: 8, note: "fine" }, conn);
    expect(result).toEqual({
      success: false,
      error:
        "Nothing was saved.\nph: Ada is editing this field right now; try again shortly.",
    });
    expect(await room.readValues(ctx)).toEqual({ ph: 7, note: "ok" });
  });

  it("names an unnamed lock owner as another staff member", async () => {
    await asExperimenting();
    await room.hydrate(ctx);
    await room.acquireLock(ctx, "ph", "conn-ghost");

    const result = await recordLabValues(ctx, { ph: 8 }, conn);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toContain(
      "ph: another staff member is editing this field right now; try again shortly.",
    );
  });

  it("allows a write when this connection already holds the lock", async () => {
    await asExperimenting();
    await room.hydrate(ctx);
    await room.acquireLock(ctx, "ph", conn);

    await expect(recordLabValues(ctx, { ph: 8 }, conn)).resolves.toMatchObject({
      success: true,
      data: { stage: "EXPERIMENTING", saved: ["ph"] },
    });
    expect(await room.readValues(ctx)).toMatchObject({ ph: 8 });
  });

  it("treats a repeatable-group child as locked when the GROUP id is locked", async () => {
    await asExperimenting();
    await room.hydrate(ctx);
    await room.setPresence(ctx, {
      connectionId: "conn-bob",
      userId: "bob",
      name: "Bob",
      color: "cyan",
    });
    await room.acquireLock(ctx, "measurements", "conn-bob");

    const result = await recordLabValues(ctx, { reading_a: [1, 2] }, conn);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toContain(
      "reading_a: Bob is editing this field right now; try again shortly.",
    );
    expect(await room.readValues(ctx)).toEqual({ ph: 7, note: "ok" });
  });

  it("collects every problem before refusing, including extra validator issues", async () => {
    await asExperimenting();
    await room.hydrate(ctx);
    await room.acquireLock(ctx, "ph", "conn-x");

    const result = await recordLabValues(
      ctx,
      { ph: 99, reading_a: [1, 2, 3], stray: "nope" },
      conn,
    );
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toContain("Nothing was saved.");
    expect(result.error).toContain("ph:");
    expect(result.error).toContain("at most 14");
    expect(result.error).toContain("another staff member is editing this field");
    expect(result.error).toContain("reading_a:");
    expect(result.error).toContain("stray: not a question in this lab form.");
    expect(await room.readValues(ctx)).toEqual({ ph: 7, note: "ok" });
    expect(updateExperiment).not.toHaveBeenCalled();
  });

  it("writes through the real Redis buffer, publishes, and flushes to experiment-manager", async () => {
    await asExperimenting();
    const publish = vi.spyOn(getRedis(), "publish");

    const result = await recordLabValues(
      ctx,
      { ph: 8.2, reading_a: [1.5, 2] },
      conn,
    );

    expect(result).toEqual({
      success: true,
      data: { stage: "EXPERIMENTING", saved: ["ph", "reading_a"] },
    });
    expect(await room.readValues(ctx)).toEqual({
      ph: 8.2,
      note: "ok",
      reading_a: [1.5, 2],
    });
    expect(publish).toHaveBeenCalledWith(
      `room:${ctx}`,
      JSON.stringify({ type: "edit", field: "ph", value: 8.2, by: conn }),
    );
    expect(publish).toHaveBeenCalledWith(
      `room:${ctx}`,
      JSON.stringify({
        type: "edit",
        field: "reading_a",
        value: [1.5, 2],
        by: conn,
      }),
    );
    expect(updateExperiment).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateExperiment).mock.calls[0]?.[1].values).toEqual({
      ph: 8.2,
      note: "ok",
      reading_a: [1.5, 2],
    });
    expect(room.scheduleFlush).not.toHaveBeenCalled();
  });

  it("schedules a retry when flushNow cannot run immediately", async () => {
    await asExperimenting();
    await room.hydrate(ctx);
    await getRedis().set(`flush:${ctx}`, "1");

    await expect(recordLabValues(ctx, { ph: 8 }, conn)).resolves.toEqual({
      success: true,
      data: { stage: "EXPERIMENTING", saved: ["ph"] },
    });
    expect(await room.readValues(ctx)).toMatchObject({ ph: 8 });
    expect(updateExperiment).not.toHaveBeenCalled();
    expect(room.scheduleFlush).toHaveBeenCalledWith(ctx);
  });

  it("schedules a retry when flushNow throws, keeping the buffer", async () => {
    await asExperimenting();
    const err = new Error("em down");
    vi.mocked(updateExperiment).mockRejectedValueOnce(err);

    await expect(recordLabValues(ctx, { ph: 8 }, conn)).resolves.toEqual({
      success: true,
      data: { stage: "EXPERIMENTING", saved: ["ph"] },
    });
    expect(await room.readValues(ctx)).toMatchObject({ ph: 8 });
    expect(logHandledError).toHaveBeenCalledWith(err, {
      op: "mcp.recordLabValues.flush",
      contextId: ctx,
    });
    expect(room.scheduleFlush).toHaveBeenCalledWith(ctx);
  });
});
