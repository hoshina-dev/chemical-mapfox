import type { AnswerIssue } from "@repo/forms";
import { ANSWER_ISSUE_CODES } from "@repo/forms";
import { describe, expect, it } from "vitest";

import en from "@/../messages/en.json";
import pl from "@/../messages/pl.json";

import { formatAnswerIssue, formatAnswerIssues } from "./answerIssues";

const issue = (partial: Partial<AnswerIssue>): AnswerIssue => ({
  path: "ph",
  questionId: "ph",
  label: "pH",
  code: "max",
  ...partial,
});

/** Stand-in for a scoped `useTranslations("forms.validation")`. */
const fakeT = (key: string, values?: Record<string, string | number | Date>) =>
  `${key}(${values?.label}, ${values?.limit})`;

describe("formatAnswerIssue", () => {
  it("passes the issue's label and limit to the code's message", () => {
    expect(formatAnswerIssue(fakeT, issue({ code: "max", limit: 14 }))).toBe(
      "max(pH, 14)",
    );
  });

  it("interpolates an empty limit for codes that don't carry one", () => {
    expect(formatAnswerIssue(fakeT, issue({ code: "type" }))).toBe("type(pH, )");
  });

  it("renders a bullet list for a server action's error text", () => {
    expect(
      formatAnswerIssues(fakeT, [
        issue({ code: "required" }),
        issue({ code: "max", limit: 14 }),
      ]),
    ).toBe("- required(pH, )\n- max(pH, 14)");
  });
});

describe("forms.validation catalog", () => {
  it.each([
    ["en", en],
    ["pl", pl],
  ])("has a message for every issue code (%s)", (_locale, messages) => {
    const validation = messages.forms.validation as Record<string, string>;
    for (const code of ANSWER_ISSUE_CODES) {
      expect(validation[code]).toBeTruthy();
      expect(validation[code]).toContain("{label}");
    }
  });
});
