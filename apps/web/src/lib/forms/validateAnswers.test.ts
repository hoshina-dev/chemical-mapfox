import type { Question } from "@repo/forms";
import {
  DEFAULT_MAX_STRING_LENGTH,
  MAX_SAFE_ANSWER_NUMBER,
  validateAnswers,
  validateField,
} from "@repo/forms";
import { describe, expect, it } from "vitest";

/** Codes only — the messages themselves are the i18n layer's job. */
function codes(issues: { code: string }[]): string[] {
  return issues.map((issue) => issue.code);
}

describe("validateAnswers", () => {
  it("accepts answers that satisfy every configured constraint", () => {
    const questions: Question[] = [
      {
        id: "ph",
        type: "number",
        label: "pH",
        required: true,
        config: { min: 0, max: 14 },
      },
      {
        id: "note",
        type: "string",
        label: "Note",
        config: { minLength: 2, maxLength: 10 },
      },
    ];
    expect(validateAnswers(questions, { ph: 7.2, note: "ok" })).toEqual([]);
  });

  it("rejects a number outside the configured range", () => {
    const questions: Question[] = [
      { id: "ph", type: "number", label: "pH", config: { min: 0, max: 14 } },
    ];
    expect(codes(validateAnswers(questions, { ph: 15 }))).toEqual(["max"]);
    expect(codes(validateAnswers(questions, { ph: -1 }))).toEqual(["min"]);
  });

  it("rejects an integer too big to round-trip through JSON, even with no configured max", () => {
    const questions: Question[] = [{ id: "count", type: "number", label: "Count" }];
    expect(codes(validateAnswers(questions, { count: MAX_SAFE_ANSWER_NUMBER }))).toEqual(
      [],
    );
    expect(
      codes(validateAnswers(questions, { count: MAX_SAFE_ANSWER_NUMBER + 2 })),
    ).toEqual(["tooLarge"]);
    expect(
      codes(validateAnswers(questions, { count: Number.POSITIVE_INFINITY })),
    ).toEqual(["notFinite"]);
    expect(codes(validateAnswers(questions, { count: Number.NaN }))).toEqual([
      "notFinite",
    ]);
  });

  it("rejects a value whose JavaScript type doesn't match the question type", () => {
    const questions: Question[] = [
      { id: "ph", type: "number", label: "pH" },
      { id: "ok", type: "boolean", label: "Confirmed" },
      { id: "note", type: "string", label: "Note" },
    ];
    expect(
      codes(validateAnswers(questions, { ph: "7", ok: "yes", note: 12 })),
    ).toEqual(["type", "type", "type"]);
  });

  it("caps text length even when the question configures no maxLength", () => {
    const questions: Question[] = [{ id: "note", type: "string", label: "Note" }];
    const long = "x".repeat(DEFAULT_MAX_STRING_LENGTH + 1);
    expect(codes(validateAnswers(questions, { note: long }))).toEqual([
      "maxLength",
    ]);
  });

  it("rejects a choice that isn't one of the offered options", () => {
    const questions: Question[] = [
      {
        id: "method",
        type: "select-string",
        label: "Method",
        config: { options: [{ label: "HPLC", value: "hplc" }] },
      },
      {
        id: "flags",
        type: "multi-select",
        label: "Flags",
        config: {
          options: [
            { label: "A", value: "a" },
            { label: "B", value: "b" },
          ],
          maxValues: 1,
        },
      },
    ];
    expect(
      codes(validateAnswers(questions, { method: "gcms", flags: ["a", "c"] })),
    ).toEqual(["option", "maxItems", "option"]);
  });

  it("rejects malformed dates, times and colors", () => {
    const questions: Question[] = [
      { id: "d", type: "date", label: "Day", config: { min: "2025-01-01" } },
      { id: "t", type: "time", label: "Time" },
      { id: "c", type: "color", label: "Colour" },
    ];
    expect(
      codes(validateAnswers(questions, { d: "2025-02-31", t: "25:00", c: "red" })),
    ).toEqual(["format", "format", "format"]);
    expect(codes(validateAnswers(questions, { d: "2024-12-31" }))).toEqual(["min"]);
    expect(
      validateAnswers(questions, { d: "2025-06-01", t: "09:30", c: "#aabbcc" }),
    ).toEqual([]);
  });

  it("accepts the colour formats Mantine's ColorInput emits", () => {
    const questions: Question[] = [
      { id: "c", type: "color", label: "Colour", config: { format: "rgba" } },
      { id: "h", type: "color", label: "Hue", config: { format: "hsl" } },
    ];
    expect(
      validateAnswers(questions, {
        c: "rgba(255, 0, 12, 0.5)",
        h: "hsl(210, 50%, 40%)",
      }),
    ).toEqual([]);
    expect(codes(validateAnswers(questions, { c: "rgb(1, 2, 3)" }))).toEqual([
      "format",
    ]);
  });

  it("still reports required blanks, with the path findMissingRequired uses", () => {
    const questions: Question[] = [
      { id: "a", type: "string", label: "Weight", required: true },
    ];
    expect(validateAnswers(questions, {})).toEqual([
      { path: "a", questionId: "a", label: "Weight", code: "required", limit: undefined },
    ]);
  });

  it("validates every repetition of a repeatable-group child", () => {
    const questions: Question[] = [
      {
        id: "reps",
        type: "repeatable-group",
        label: "Measurement",
        config: {
          count: 2,
          questions: [
            {
              id: "reading",
              type: "number",
              label: "Reading",
              config: { max: 100 },
            },
          ],
        },
      },
    ];
    const issues = validateAnswers(questions, { reading: [10, 500] });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: "reps.reading[1]",
      code: "max",
      limit: 100,
    });
    // More entries than the group repeats is itself a violation.
    expect(codes(validateAnswers(questions, { reading: [1, 2, 3] }))).toEqual([
      "extraRepetitions",
    ]);
  });

  it("reports values that answer no question only when asked to", () => {
    const questions: Question[] = [{ id: "a", type: "string", label: "Weight" }];
    expect(validateAnswers(questions, { a: "1", stray: "x" })).toEqual([]);
    expect(
      codes(validateAnswers(questions, { a: "1", stray: "x" }, {
        rejectUnknownFields: true,
      })),
    ).toEqual(["unknownField"]);
  });

  it("live mode keeps half-entered answers valid but still blocks impossible ones", () => {
    const questions: Question[] = [
      {
        id: "ph",
        type: "number",
        label: "pH",
        required: true,
        config: { min: 5, max: 9 },
      },
      {
        id: "note",
        type: "string",
        label: "Note",
        config: { minLength: 5 },
      },
    ];
    const live = { mode: "live" } as const;
    // Not filled in yet / still too short / not yet up to the minimum.
    expect(validateAnswers(questions, { note: "ab", ph: 1 }, live)).toEqual([]);
    // Nothing a user can type their way out of.
    expect(codes(validateAnswers(questions, { ph: 20 }, live))).toEqual(["max"]);
    expect(codes(validateAnswers(questions, { ph: "7" }, live))).toEqual(["type"]);
  });
});

describe("validateField", () => {
  const questions: Question[] = [
    { id: "ph", type: "number", label: "pH", config: { max: 14 } },
    {
      id: "reps",
      type: "repeatable-group",
      label: "Measurement",
      config: {
        count: 2,
        questions: [{ id: "reading", type: "number", label: "Reading" }],
      },
    },
  ];

  it("validates a single top-level field", () => {
    expect(validateField(questions, "ph", 7)).toEqual([]);
    expect(codes(validateField(questions, "ph", 99) ?? [])).toEqual(["max"]);
  });

  it("validates a repeatable-group child's whole column", () => {
    expect(validateField(questions, "reading", [1, 2])).toEqual([]);
    expect(codes(validateField(questions, "reading", [1, "x"]) ?? [])).toEqual([
      "type",
    ]);
    expect(codes(validateField(questions, "reading", "nope") ?? [])).toEqual([
      "type",
    ]);
  });

  it("treats a cleared field as valid — clearing is not an invalid answer", () => {
    expect(validateField(questions, "ph", null)).toEqual([]);
    expect(validateField(questions, "reading", null)).toEqual([]);
  });

  it("returns null for a field that belongs to no question", () => {
    expect(validateField(questions, "stray", 1)).toBeNull();
  });
});
