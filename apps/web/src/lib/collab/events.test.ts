import { describe, expect, it } from "vitest";

import { ClientEvent } from "./events";

const cid = "conn-1";

describe("ClientEvent", () => {
  it("accepts every valid event shape", () => {
    expect(
      ClientEvent.safeParse({ type: "focus", connectionId: cid, field: "q1" })
        .success,
    ).toBe(true);
    expect(
      ClientEvent.safeParse({ type: "blur", connectionId: cid, field: "q1" })
        .success,
    ).toBe(true);
    expect(
      ClientEvent.safeParse({
        type: "edit",
        connectionId: cid,
        field: "q1",
        value: "hi",
      }).success,
    ).toBe(true);
    // clearing a field: explicit null...
    expect(
      ClientEvent.safeParse({
        type: "edit",
        connectionId: cid,
        field: "q1",
        value: null,
      }).success,
    ).toBe(true);
    // ...or a missing value key (JSON.stringify drops `undefined`) — must parse,
    // otherwise a clear would 400 and never propagate.
    expect(
      ClientEvent.safeParse({ type: "edit", connectionId: cid, field: "q1" })
        .success,
    ).toBe(true);
    expect(
      ClientEvent.safeParse({
        type: "edit",
        connectionId: cid,
        field: "q1",
        value: [1, 2],
      }).success,
    ).toBe(true);
    expect(
      ClientEvent.safeParse({ type: "heartbeat", connectionId: cid }).success,
    ).toBe(true);
  });

  it("rejects malformed events", () => {
    // missing connectionId
    expect(
      ClientEvent.safeParse({ type: "focus", field: "q1" }).success,
    ).toBe(false);
    // missing field
    expect(
      ClientEvent.safeParse({ type: "focus", connectionId: cid }).success,
    ).toBe(false);
    // empty field
    expect(
      ClientEvent.safeParse({ type: "focus", connectionId: cid, field: "" })
        .success,
    ).toBe(false);
    expect(ClientEvent.safeParse({ type: "nope", connectionId: cid }).success).toBe(
      false,
    );
    expect(ClientEvent.safeParse({}).success).toBe(false);
    expect(ClientEvent.safeParse(null).success).toBe(false);
  });
});
