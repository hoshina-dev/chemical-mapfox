import type { AnswerValue, FormDoc } from "@repo/forms";

/**
 * One intake form for several methods of one sample: every method's client form
 * questions, a question id shared by several methods asked once (its first form
 * wins). Used by the request page and re-checked by the request action.
 */
export function mergeClientForms(forms: FormDoc[], name: string): FormDoc {
  const seen = new Set<string>();
  const questions = forms.flatMap((form) =>
    form.questions.filter((q) => !seen.has(q.id) && seen.add(q.id)),
  );
  return { ...forms[0], name, questions } as FormDoc;
}

/** The answers that belong to one method's client form. */
export function answersFor(
  form: FormDoc,
  answers: Record<string, AnswerValue>,
): Record<string, AnswerValue> {
  const ids = new Set(form.questions.map((q) => q.id));
  return Object.fromEntries(Object.entries(answers).filter(([id]) => ids.has(id)));
}
