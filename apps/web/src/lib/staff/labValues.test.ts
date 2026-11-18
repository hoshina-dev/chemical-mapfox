import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/collab/room", () => ({
  applyEdit: vi.fn(),
  flushNow: vi.fn(),
  hydrate: vi.fn(),
  publish: vi.fn(),
  readLocks: vi.fn(),
  readPresence: vi.fn(),
  readTemplate: vi.fn(),
  scheduleFlush: vi.fn(),
}));
vi.mock("@/lib/experiment-manager/client", () => ({ getTicket: vi.fn() }));
vi.mock("@/lib/log/handled", () => ({ logHandledError: vi.fn() }));

import {
  applyEdit,
  flushNow,
  publish,
  readLocks,
  readPresence,
  readTemplate,
  scheduleFlush,
} from "@/lib/collab/room";
import { getTicket, type Ticket } from "@/lib/experiment-manager/client";

import { recordLabValues } from "./labValues";

const editor = { userId: "staff-ada", connectionId: "mcp:grant-1" };
const labForm = {
  name: "Lab",
  questions: [
    {
      id: "ph",
      type: "number",
      label: "pH",
      required: true,
      config: { min: 0, max: 14 },
    },
    {
      id: "replicates",
      type: "repeatable-group",
      label: "Replicates",
      config: {
        count: 2,
        questions: [{ id: "reading", type: "number", label: "Reading" }],
      },
    },
  ],
};

function withStatus(status: string) {
  vi.mocked(getTicket).mockResolvedValue({
    experiments: [{ id: "exp-1", status }],
  } as Ticket);
}

beforeEach(() => {
  vi.clearAllMocks();
  withStatus("IN_PROGRESS");
  vi.mocked(readTemplate).mockResolvedValue({ labForm } as never);
  vi.mocked(readLocks).mockResolvedValue({});
  vi.mocked(readPresence).mockResolvedValue([]);
  vi.mocked(flushNow).mockResolvedValue(true);
});

describe("recordLabValues", () => {
  it("writes each value into the experiment's room as the staff member, broadcasts it and saves", async () => {
    const result = await recordLabValues(editor, "t1", "exp-1", {
      ph: 7.2,
      reading: [1, 2],
    });

    expect(result).toEqual({
      success: true,
      data: { saved: ["ph", "reading"] },
    });
    expect(applyEdit).toHaveBeenCalledWith("t1_exp-1", "ph", 7.2, "staff-ada");
    expect(applyEdit).toHaveBeenCalledWith(
      "t1_exp-1",
      "reading",
      [1, 2],
      "staff-ada",
    );
    expect(publish).toHaveBeenCalledWith("t1_exp-1", {
      type: "edit",
      field: "ph",
      value: 7.2,
      by: "mcp:grant-1",
    });
    expect(flushNow).toHaveBeenCalledWith("t1_exp-1");
  });

  it("only writes while the experiment is IN_PROGRESS", async () => {
    withStatus("FINISHED");
    const finished = await recordLabValues(editor, "t1", "exp-1", { ph: 7 });
    expect(finished).toMatchObject({
      success: false,
      error: expect.stringContaining("it is FINISHED"),
    });

    const missing = await recordLabValues(editor, "t1", "exp-9", { ph: 7 });
    expect(missing).toMatchObject({
      success: false,
      error: expect.stringContaining("not on this ticket"),
    });
    expect(applyEdit).not.toHaveBeenCalled();
  });

  it("saves nothing when any value is invalid or unknown, naming each problem", async () => {
    const result = await recordLabValues(editor, "t1", "exp-1", {
      ph: 20,
      colour: "red",
      reading: [1, 2],
    });

    expect(result.success).toBe(false);
    const error = result.success ? "" : result.error;
    expect(error).toMatch(/^Nothing was saved\./);
    expect(error).toContain("ph:");
    expect(error).toContain("colour: not a question in this lab form.");
    expect(applyEdit).not.toHaveBeenCalled();
  });

  it("allows clearing a required field (finish enforces required)", async () => {
    const result = await recordLabValues(editor, "t1", "exp-1", { ph: null });
    expect(result.success).toBe(true);
    expect(applyEdit).toHaveBeenCalledWith("t1_exp-1", "ph", null, "staff-ada");
  });

  it("refuses a field a colleague is editing, including a repeatable child locked by its group", async () => {
    vi.mocked(readLocks).mockResolvedValue({ replicates: "tab-bob" });
    vi.mocked(readPresence).mockResolvedValue([
      { connectionId: "tab-bob", name: "Bob" } as Awaited<
        ReturnType<typeof readPresence>
      >[number],
    ]);

    const result = await recordLabValues(editor, "t1", "exp-1", {
      ph: 7,
      reading: [1, 2],
    });
    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining(
        "reading: Bob is editing this field right now",
      ),
    });
    expect(applyEdit).not.toHaveBeenCalled();
  });

  it("keeps the values in the room for the debounced save when saving now fails", async () => {
    vi.mocked(flushNow).mockRejectedValue(new Error("experiment-manager down"));

    const result = await recordLabValues(editor, "t1", "exp-1", { ph: 7 });
    expect(result.success).toBe(true);
    expect(scheduleFlush).toHaveBeenCalledWith("t1_exp-1");
  });
});
