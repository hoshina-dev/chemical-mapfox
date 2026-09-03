import type { AnswerIssue } from "@repo/forms";

/**
 * Loosely-typed translator so callers can pass a scoped
 * `useTranslations("forms.validation")` / `getTranslations(...)`. Values match
 * what next-intl accepts for ICU interpolation.
 */
export type IssueTranslateFn = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

/**
 * Localized message for one validation issue. `t` must be scoped to
 * `forms.validation` — each `AnswerIssueCode` is a key there, taking `{label}`
 * and (where the constraint matters) `{limit}`.
 *
 * `@repo/forms` reports issues as codes rather than sentences precisely so the
 * same validator can be rendered in the user's locale here and in plain English
 * inside the package's own default (`describeAnswerIssue`).
 */
export function formatAnswerIssue(t: IssueTranslateFn, issue: AnswerIssue): string {
  return t(issue.code, { label: issue.label, limit: issue.limit ?? "" });
}

/** Issue messages as a bullet list — the shape server actions return as `error`. */
export function formatAnswerIssues(
  t: IssueTranslateFn,
  issues: AnswerIssue[],
): string {
  return issues.map((issue) => `- ${formatAnswerIssue(t, issue)}`).join("\n");
}
