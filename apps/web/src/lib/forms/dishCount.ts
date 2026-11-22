type Loose = Record<string, unknown>;

/**
 * A dish run allows `maxDishes` dishes and its group draws `config.count` rows: one
 * number in practice (a lower count breaks the dish run, a higher one is never used).
 * The builder edits only Max dishes, so every save copies it into the group's count.
 * Templates without a dish run are returned unchanged.
 */
export function withDishCount<T extends Loose>(template: T): T {
  const labForm = template.labForm as Loose | undefined;
  const dishRun = labForm?.dishRun as Loose | undefined;
  const maxDishes = dishRun?.maxDishes;
  if (!labForm || typeof maxDishes !== "number" || !Array.isArray(labForm.questions)) {
    return template;
  }
  const questions = labForm.questions.map((question: Loose) =>
    question?.id === dishRun?.group && question?.type === "repeatable-group"
      ? { ...question, config: { ...(question.config as Loose), count: maxDishes } }
      : question,
  );
  return { ...template, labForm: { ...labForm, questions } };
}
