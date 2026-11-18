import type { AnswerValue, Question } from "./schema";

/** A date question's `config.default` that means "the day the form is opened". */
export const TODAY_DEFAULT = "today";

/** `YYYY-MM-DD` of `date` in the browser's (or server's) local time zone. */
export function localDateString(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The question's `config.default` as an answer, resolving `TODAY_DEFAULT` at call
 * time. `undefined` when the question configures no default.
 */
export function configuredDefault(q: Question): AnswerValue {
  const config = q.config;
  if (!config || !("default" in config) || config.default === undefined) {
    return undefined;
  }
  if (q.type === "date" && config.default === TODAY_DEFAULT) {
    return localDateString();
  }
  return config.default as AnswerValue;
}
