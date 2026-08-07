import type { FormAnswers, Question, QuestionType } from "./schema";

/** A required question (or repeatable-group repetition) with no answer. */
export interface MissingRequired {
  /** `questionId` for a top-level question, `groupId.childId[index]` for a repeatable-group entry. */
  path: string;
  label: string;
}

function isAnswerEmpty(type: QuestionType, value: unknown): boolean {
  switch (type) {
    case "boolean":
      // A switch always has a value (true/false) — nothing to require.
      return false;
    case "multi-select":
    case "checkbox-group":
    case "tags":
      return !Array.isArray(value) || value.length === 0;
    case "number":
    case "select-number":
    case "slider":
    case "rating":
      return value === undefined || value === null;
    default:
      return value === undefined || value === null || value === "";
  }
}

/**
 * Every required question (recursing into repeatable-group children, checked
 * across all `config.count` repetitions) that has no answer in `values`.
 * Empty array means the form is complete.
 */
export function findMissingRequired(
  questions: Question[],
  values: FormAnswers,
): MissingRequired[] {
  const missing: MissingRequired[] = [];

  for (const question of questions) {
    if (question.type === "repeatable-group") {
      const { count, questions: children } = question.config;
      for (const child of children) {
        if (!child.required) continue;
        const answers = values[child.id];
        for (let i = 0; i < count; i++) {
          const value = Array.isArray(answers) ? answers[i] : undefined;
          if (isAnswerEmpty(child.type, value)) {
            missing.push({
              path: `${question.id}.${child.id}[${i}]`,
              label: `${question.label} #${i + 1} — ${child.label}`,
            });
          }
        }
      }
      continue;
    }

    if (!question.required) continue;
    if (isAnswerEmpty(question.type, values[question.id])) {
      missing.push({ path: question.id, label: question.label });
    }
  }

  return missing;
}
