import {
  configuredDefault,
  initialAnswersFor,
  localDateString,
  type Question,
  TODAY_DEFAULT,
} from "@repo/forms";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const today: Question = {
  id: "received",
  type: "date",
  label: "Received",
  config: { default: TODAY_DEFAULT },
};

describe("date default of today", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 2, 5, 23, 59));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats the local calendar day, zero-padded", () => {
    expect(localDateString()).toBe("2026-03-05");
    expect(localDateString(new Date(2026, 10, 17))).toBe("2026-11-17");
  });

  it("resolves to the date the answers are initialised, not a fixed one", () => {
    expect(configuredDefault(today)).toBe("2026-03-05");
    vi.setSystemTime(new Date(2026, 2, 6, 0, 1));
    expect(initialAnswersFor([today])).toEqual({ received: "2026-03-06" });
  });

  it("resolves inside a repeatable group", () => {
    const group: Question = {
      id: "runs",
      type: "repeatable-group",
      label: "Runs",
      config: { count: 2, questions: [{ ...today, id: "run_date" }] },
    };
    expect(initialAnswersFor([group])).toEqual({ run_date: ["2026-03-05", "2026-03-05"] });
  });

  it("leaves a fixed date and an unset default unchanged", () => {
    const fixed: Question = { id: "a", type: "date", label: "A", config: { default: "2025-01-02" } };
    const unset: Question = { id: "b", type: "date", label: "B" };
    expect(initialAnswersFor([fixed, unset])).toEqual({ a: "2025-01-02", b: undefined });
  });

  it("is only a sentinel for date questions", () => {
    const text: Question = { id: "t", type: "string", label: "T", config: { default: TODAY_DEFAULT } };
    expect(configuredDefault(text)).toBe(TODAY_DEFAULT);
  });

  it("is not applied to stored-answer views", () => {
    expect(initialAnswersFor([today], { fillDefaults: false })).toEqual({ received: undefined });
  });
});
