import type { Question } from "@repo/forms";
import { findMissingRequired } from "@repo/forms";
import { describe, expect, it } from "vitest";

describe("findMissingRequired", () => {
  it("flags a required top-level question with no answer", () => {
    const questions: Question[] = [
      { id: "a", type: "string", label: "Weight", required: true },
      { id: "b", type: "string", label: "Notes", required: false },
    ];
    expect(findMissingRequired(questions, {})).toEqual([
      { path: "a", label: "Weight" },
    ]);
    expect(findMissingRequired(questions, { a: "150" })).toEqual([]);
  });

  it("does not flag a falsy-but-valid number answer (0 is a real value)", () => {
    const questions: Question[] = [
      { id: "n", type: "number", label: "Volume", required: true },
    ];
    expect(findMissingRequired(questions, { n: 0 })).toEqual([]);
    expect(findMissingRequired(questions, {})).toEqual([
      { path: "n", label: "Volume" },
    ]);
  });

  it("never flags a required boolean — it always has a value (defaults to false)", () => {
    const questions: Question[] = [
      { id: "bool", type: "boolean", label: "Confirmed", required: true },
    ];
    expect(findMissingRequired(questions, {})).toEqual([]);
    expect(findMissingRequired(questions, { bool: false })).toEqual([]);
    expect(findMissingRequired(questions, { bool: true })).toEqual([]);
  });

  it("recurses into repeatable-group children across every repetition — the reported bug", () => {
    const questions: Question[] = [
      {
        id: "reps",
        type: "repeatable-group",
        label: "Measurement",
        required: true,
        config: {
          count: 3,
          questions: [
            { id: "reading", type: "number", label: "Reading", required: true },
          ],
        },
      },
    ];
    // Only 2 of 3 repetitions filled in — this is exactly what the user did:
    // left required repeatable-group fields empty and could still submit.
    const missing = findMissingRequired(questions, { reading: [10, 12] });
    expect(missing).toEqual([
      { path: "reps.reading[2]", label: "Measurement #3 — Reading" },
    ]);

    expect(findMissingRequired(questions, { reading: [10, 12, 14] })).toEqual([]);
  });

  it("ignores non-required repeatable-group children", () => {
    const questions: Question[] = [
      {
        id: "reps",
        type: "repeatable-group",
        label: "Measurement",
        required: true,
        config: {
          count: 2,
          questions: [
            { id: "note", type: "string", label: "Note", required: false },
          ],
        },
      },
    ];
    expect(findMissingRequired(questions, {})).toEqual([]);
  });
});
