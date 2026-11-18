import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@/lib/log/handled", () => ({ logHandledError: vi.fn() }));
vi.mock("@/lib/collab/room", () => ({
  hydrate: vi.fn(),
  persistNow: vi.fn(),
  resetRoom: vi.fn(),
}));
vi.mock("@/lib/sample-tracker/client", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/sample-tracker/client")>()),
  finishExperiment: vi.fn(),
}));

import { resetRoom } from "@/lib/collab/room";
import { finishExperiment } from "@/lib/sample-tracker/client";

import { finish } from "./lifecycle";

const ROOM = "ticket-1_exp-1";

/** `calculationsJson` as the browser engine produces it. */
function calculations(extra: Record<string, { result?: unknown }> = {}): string {
  return JSON.stringify({
    G: { formula: "…", result: [8.42, 8.55] },
    ...extra,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("finish", () => {
  // An ordinary method generates no `accepted_pair`, so the dish gate has to be
  // completely inert for it — every experiment in the lab goes through here.
  it("finishes a method that has no dish run", async () => {
    const result = await finish("actor-1", ROOM, 3, calculations());
    expect(result).toEqual({ success: true, data: null });

    const [actor, ticketId, experimentId, body] =
      vi.mocked(finishExperiment).mock.calls[0] ?? [];
    expect([actor, ticketId, experimentId]).toEqual(["actor-1", "ticket-1", "exp-1"]);
    expect(body?.version).toBe(3);
    // Numbers travel as the text Python wrote (so 5.0 stays 5.0), which is why
    // the results are compared after a round trip rather than structurally.
    expect(JSON.parse(JSON.stringify(body?.results))).toEqual({ G: [8.42, 8.55] });
    expect(resetRoom).toHaveBeenCalledWith(ROOM);
  });

  it("finishes a dish run once a pair has been accepted", async () => {
    const result = await finish(
      "actor-1",
      ROOM,
      3,
      calculations({
        accepted_pair: { result: [0, 1] },
        final_G: { result: 8.48 },
      }),
    );
    expect(result).toEqual({ success: true, data: null });
    expect(resetRoom).toHaveBeenCalledWith(ROOM);
  });

  // The authoritative gate: `accepted_pair` is `None` when no two dishes agreed,
  // so there is no figure to certify. The disabled button in the UI is only a
  // courtesy — this is what makes it impossible.
  it("refuses a dish run where no pair agrees, without finishing anything", async () => {
    const result = await finish(
      "actor-1",
      ROOM,
      3,
      calculations({ accepted_pair: { result: null }, final_G: { result: null } }),
    );
    expect(result).toEqual({ success: false, error: "dishesDisagree" });
    expect(finishExperiment).not.toHaveBeenCalled();
    expect(resetRoom).not.toHaveBeenCalled();
  });

  // A target that failed or was skipped leaves `accepted_pair` without a result
  // at all, which must read as "no pair agreed", never as "fine to finish".
  it("refuses a dish run whose accepted pair never evaluated", async () => {
    const result = await finish(
      "actor-1",
      ROOM,
      3,
      calculations({ accepted_pair: {} }),
    );
    expect(result).toEqual({ success: false, error: "dishesDisagree" });
    expect(finishExperiment).not.toHaveBeenCalled();
  });

  it("refuses a room id that is not {ticketId}_{experimentId}", async () => {
    const result = await finish("actor-1", "no-experiment", 3, calculations());
    expect(result).toEqual({ success: false, error: "finishFailed" });
    expect(finishExperiment).not.toHaveBeenCalled();
  });

  it("refuses results that are not JSON", async () => {
    const result = await finish("actor-1", ROOM, 3, "not json");
    expect(result).toEqual({ success: false, error: "finishFailed" });
    expect(finishExperiment).not.toHaveBeenCalled();
  });
});
