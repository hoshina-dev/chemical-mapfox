import { beforeEach, describe, expect, it, vi } from "vitest";

// Back the room with an in-memory Redis and stub the experiment-manager client.
// (ioredis-mock is imported inside the factory — vi.mock factories can't close
// over top-level imports.)
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

import {
  getExperiment,
  updateExperiment,
} from "@/lib/experiment-manager/client";
import { getRedis } from "@/lib/redis/client";

import * as room from "./room";

const ctx = "ctx-1";

const detail = {
  id: ctx,
  sample_id: "s1",
  template_id: "t1",
  clientForm: { name: "Client", questions: [] },
  labForm: {
    name: "Lab",
    questions: [{ id: "ph", type: "number", label: "pH", required: false }],
  },
  calculations: {},
  values: { ph: 7 },
  created_at: "2026-01-01T00:00:00Z",
  report_status: null,
};

beforeEach(async () => {
  await getRedis().flushall();
  vi.mocked(getExperiment).mockReset().mockResolvedValue(detail as never);
  vi.mocked(updateExperiment).mockReset().mockResolvedValue({} as never);
});

describe("buffer + flush", () => {
  it("hydrates the buffer from experiment-manager exactly once", async () => {
    await room.hydrate(ctx);
    expect(getExperiment).toHaveBeenCalledTimes(1);
    expect(await room.readValues(ctx)).toEqual({ ph: 7 });

    await room.hydrate(ctx); // idempotent
    expect(getExperiment).toHaveBeenCalledTimes(1);
  });

  it("applies edits and flushes the merged values to EM", async () => {
    await room.hydrate(ctx);
    await room.applyEdit(ctx, "ph", 8);
    await room.applyEdit(ctx, "note", "looks good");
    expect(await room.readValues(ctx)).toEqual({ ph: 8, note: "looks good" });

    expect(await room.flushNow(ctx)).toBe(true);
    expect(updateExperiment).toHaveBeenCalledTimes(1);
    const call = vi.mocked(updateExperiment).mock.calls[0]!;
    expect(call[0]).toBe(ctx);
    expect(call[1].values).toEqual({ ph: 8, note: "looks good" });
    expect(call[1].labForm).toEqual(detail.labForm);
    expect(call[1].clientForm).toEqual(detail.clientForm);
  });

  it("does not re-flush when nothing is dirty", async () => {
    await room.hydrate(ctx);
    await room.applyEdit(ctx, "ph", 8);
    expect(await room.flushNow(ctx)).toBe(true);
    expect(await room.flushNow(ctx)).toBe(false);
    expect(updateExperiment).toHaveBeenCalledTimes(1);
  });

  it("single-flights — skips when another flush holds the lock", async () => {
    await room.hydrate(ctx);
    await room.applyEdit(ctx, "ph", 8);
    await getRedis().set(`flush:${ctx}`, "1"); // simulate a concurrent flusher
    expect(await room.flushNow(ctx)).toBe(false);
    expect(updateExperiment).not.toHaveBeenCalled();
  });

  it("removes a field from the buffer when cleared to null", async () => {
    await room.hydrate(ctx);
    await room.applyEdit(ctx, "ph", null);
    expect(await room.readValues(ctx)).toEqual({});
  });
});

describe("soft field locks (owned by connectionId)", () => {
  it("first focus wins; a different connection is denied", async () => {
    expect(await room.acquireLock(ctx, "ph", "conn-a")).toEqual({
      ok: true,
      owner: "conn-a",
    });
    // a second tab (even of the same user) is a different connection → denied
    expect(await room.acquireLock(ctx, "ph", "conn-b")).toEqual({
      ok: false,
      owner: "conn-a",
    });
  });

  it("the owning connection may re-acquire (refresh) its own lock", async () => {
    await room.acquireLock(ctx, "ph", "conn-a");
    expect(await room.acquireLock(ctx, "ph", "conn-a")).toEqual({
      ok: true,
      owner: "conn-a",
    });
  });

  it("release is owner-checked", async () => {
    await room.acquireLock(ctx, "ph", "conn-a");
    expect(await room.releaseLock(ctx, "ph", "conn-b")).toBe(false);
    expect(await room.readLocks(ctx)).toEqual({ ph: "conn-a" });
    expect(await room.releaseLock(ctx, "ph", "conn-a")).toBe(true);
    expect(await room.readLocks(ctx)).toEqual({});
  });

  it("refresh is owner-checked", async () => {
    await room.acquireLock(ctx, "ph", "conn-a");
    expect(await room.refreshLock(ctx, "ph", "conn-b")).toBe(false);
    expect(await room.refreshLock(ctx, "ph", "conn-a")).toBe(true);
  });
});

describe("presence + snapshot", () => {
  it("tracks per-connection presence and assembles a snapshot", async () => {
    await room.hydrate(ctx);
    const entry = {
      connectionId: "conn-a",
      userId: "alice",
      name: "Alice",
      avatarUrl: null,
      color: "grape",
    };
    await room.setPresence(ctx, entry);
    await room.acquireLock(ctx, "ph", "conn-a");

    const snap = await room.getSnapshot(ctx);
    expect(snap.values).toEqual({ ph: 7 });
    expect(snap.presence).toEqual([entry]);
    expect(snap.locks).toEqual({ ph: "conn-a" });

    await room.dropPresence(ctx, "conn-a");
    expect(await room.readPresence(ctx)).toEqual([]);
  });

  it("keeps a user present while any of their connections remain", async () => {
    await room.hydrate(ctx);
    const base = { userId: "alice", name: "Alice", avatarUrl: null, color: "grape" };
    await room.setPresence(ctx, { ...base, connectionId: "tab-1" });
    await room.setPresence(ctx, { ...base, connectionId: "tab-2" });

    await room.dropPresence(ctx, "tab-1"); // close one tab
    const presence = await room.readPresence(ctx);
    expect(presence).toHaveLength(1);
    expect(presence[0]!.connectionId).toBe("tab-2");
  });
});

describe("disconnect cleanup", () => {
  it("frees the dropped connection's locks + presence, leaving others intact", async () => {
    await room.hydrate(ctx);
    await room.setPresence(ctx, {
      connectionId: "conn-a",
      userId: "alice",
      name: "Alice",
      avatarUrl: null,
      color: "grape",
    });
    await room.setPresence(ctx, {
      connectionId: "conn-b",
      userId: "bob",
      name: "Bob",
      avatarUrl: null,
      color: "cyan",
    });
    await room.acquireLock(ctx, "ph", "conn-a");
    await room.acquireLock(ctx, "note", "conn-b");

    await room.handleDisconnect(ctx, "conn-a");

    // conn-a's lock is released; conn-b's survives
    expect(await room.readLocks(ctx)).toEqual({ note: "conn-b" });
    // conn-a is gone from presence; conn-b remains
    const presence = await room.readPresence(ctx);
    expect(presence.map((p) => p.connectionId)).toEqual(["conn-b"]);
  });
});
