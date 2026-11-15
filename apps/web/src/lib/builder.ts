import type {
  ExperimentTemplate,
  FormDoc,
  NestedQuestion,
  Question,
  QuestionType,
} from "@repo/forms";

import {
  ACCEPTED_PAIR_CALC,
  finalCalcName,
  generateAcceptedPairFormula,
  generateDishFormula,
  generateFinalFormula,
} from "@/lib/forms/dishFormula";

export interface CalcEntry {
  name: string;
  formula: string;
}

export interface TemplateMeta {
  title: string;
  description?: string;
}

export interface FormDraft {
  title: string;
  description?: string;
  clientForm: FormDoc;
  labForm: FormDoc;
  calculations: CalcEntry[];
}

/** Loosely-typed translator so callers can pass a scoped `useTranslations("builder")`. */
export type TranslateFn = (key: string, values?: Record<string, unknown>) => string;

/** Maps each `QuestionType` to its leaf key under `builder.questionTypes`. */
const QUESTION_TYPE_MESSAGE_KEYS: Record<QuestionType, string> = {
  string: "string",
  textarea: "textarea",
  password: "password",
  number: "number",
  "select-string": "selectString",
  "select-number": "selectNumber",
  "multi-select": "multiSelect",
  radio: "radio",
  "checkbox-group": "checkboxGroup",
  boolean: "boolean",
  segmented: "segmented",
  slider: "slider",
  rating: "rating",
  color: "color",
  date: "date",
  time: "time",
  datetime: "datetime",
  tags: "tags",
  "repeatable-group": "repeatableGroup",
};

export const QUESTION_TYPE_VALUES = Object.keys(
  QUESTION_TYPE_MESSAGE_KEYS,
) as QuestionType[];

export const NESTED_QUESTION_TYPE_VALUES = QUESTION_TYPE_VALUES.filter(
  (value) => value !== "repeatable-group",
);

/** Translate a question type into its display label (`builder.questionTypes.*`). */
export function getQuestionTypeLabel(t: TranslateFn, type: QuestionType): string {
  return t(`questionTypes.${QUESTION_TYPE_MESSAGE_KEYS[type]}`);
}

export function getQuestionTypeOptions(
  t: TranslateFn,
): { value: QuestionType; label: string }[] {
  return QUESTION_TYPE_VALUES.map((value) => ({
    value,
    label: getQuestionTypeLabel(t, value),
  }));
}

export function getNestedQuestionTypeOptions(
  t: TranslateFn,
): { value: QuestionType; label: string }[] {
  return NESTED_QUESTION_TYPE_VALUES.map((value) => ({
    value,
    label: getQuestionTypeLabel(t, value),
  }));
}

export function emptyDraft(): FormDraft {
  return {
    title: "Untitled Form",
    description: "",
    clientForm: { name: "Client form", description: "", questions: [] },
    labForm: { name: "Lab form", description: "", questions: [] },
    calculations: [],
  };
}

// Names owned by the dish run, whose formulas are generated, not hand-written
function dishCalculationNames(labForm: FormDoc): Set<string> {
  const dishRun = labForm.dishRun;
  const names = new Set<string>();
  for (const entry of dishRun?.calculations ?? []) {
    const trimmed = entry.name.trim();
    if (trimmed) names.add(trimmed);
  }
  if ((dishRun?.finals ?? []).length > 0) names.add(ACCEPTED_PAIR_CALC);
  for (const target of dishRun?.finals ?? []) names.add(finalCalcName(target));
  return names;
}

/**
 * Measurement ids of the dish group, each of which is a per-dish column in
 * `values`.
 */
function dishMeasurementIds(labForm: FormDoc): string[] {
  const groupId = labForm.dishRun?.group;
  const group = labForm.questions.find((question) => question.id === groupId);
  return group?.type === "repeatable-group"
    ? group.config.questions.map((child) => child.id)
    : [];
}

// The Python for each per-dish calculation, generated from the authored expressions.
function generatedDishCalculations(
  labForm: FormDoc,
): ExperimentTemplate["calculations"] {
  const entries = labForm.dishRun?.calculations ?? [];
  const measurements = dishMeasurementIds(labForm);
  const generated: ExperimentTemplate["calculations"] = {};

  entries.forEach((entry, index) => {
    const name = entry.name.trim();
    if (!name) return;
    // Only entries *before* this one, so a chain cannot reference itself or
    // depend on something defined later.
    const earlier = entries
      .slice(0, index)
      .map((candidate) => candidate.name.trim())
      .filter(Boolean);
    const result = generateDishFormula(entry.expression, (reference) => {
      if (measurements.includes(reference)) return `values['${reference}']`;
      return earlier.includes(reference) ? reference : undefined;
    });
    if (result.ok) generated[name] = { formula: result.formula };
  });

  // The reported values. Generated as calculations.
  const dishRun = labForm.dishRun;
  const finals = dishRun?.finals ?? [];
  const authored = new Set(Object.keys(generated));
  const seriesOf = (name: string): string | undefined => {
    if (measurements.includes(name)) return `values['${name}']`;
    return authored.has(name) ? name : undefined;
  };

  const ruleSources = (dishRun?.rules ?? []).flatMap((rule) => {
    const series = seriesOf(rule.target);
    return series === undefined
      ? []
      : [{ series, limit: rule.limit.value, decimals: rule.decimals }];
  });

  if (ruleSources.length > 0 && finals.length > 0) {
    generated[ACCEPTED_PAIR_CALC] = {
      formula: generateAcceptedPairFormula(ruleSources, dishRun?.maxDishes ?? 8),
    };
    for (const target of finals) {
      const series = seriesOf(target);
      if (series === undefined) continue;
      // Report at the precision the tolerance for this quantity is stated in,
      // when there is one, so the certificate matches the comparison.
      const decimals = (dishRun?.rules ?? []).find((rule) => rule.target === target)
        ?.decimals;
      generated[finalCalcName(target)] = {
        formula: generateFinalFormula(series, decimals),
      };
    }
  }
  return generated;
}

export function toDraft(
  meta: TemplateMeta,
  template: ExperimentTemplate,
): FormDraft {
  const owned = dishCalculationNames(template.labForm);
  return {
    title: meta.title,
    description: meta.description,
    clientForm: template.clientForm,
    labForm: template.labForm,
    // Dish formulas are edited as expressions in the dish-run panel, so they
    // must not also appear as raw-Python rows in the calculations list
    calculations: Object.entries(template.calculations)
      .filter(([name]) => !owned.has(name))
      .map(([name, { formula }]) => ({ name, formula })),
  };
}

export function fromDraft(draft: FormDraft): {
  meta: TemplateMeta;
  template: ExperimentTemplate;
} {
  const calculations: ExperimentTemplate["calculations"] = {};
  for (const { name, formula } of draft.calculations) {
    const trimmed = name.trim();
    if (trimmed) calculations[trimmed] = { formula };
  }
  // Generated last, so a dish calculation always wins over a stale hand-written
  // entry of the same name.
  Object.assign(calculations, generatedDishCalculations(draft.labForm));
  return {
    meta: { title: draft.title, description: draft.description },
    template: {
      clientForm: draft.clientForm,
      labForm: draft.labForm,
      calculations,
    },
  };
}

interface QuestionBase {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
}

export function makeQuestion(
  type: QuestionType,
  base?: Partial<QuestionBase>,
): Question {
  const common: QuestionBase = {
    id: base?.id ?? "",
    label: base?.label ?? "",
    description: base?.description,
    required: base?.required,
  };
  switch (type) {
    case "string":
      return { ...common, type: "string", config: {} };
    case "textarea":
      return { ...common, type: "textarea", config: {} };
    case "password":
      return { ...common, type: "password", config: {} };
    case "number":
      return { ...common, type: "number", config: {} };
    case "select-string":
      return { ...common, type: "select-string", config: { options: [] } };
    case "select-number":
      return { ...common, type: "select-number", config: { options: [] } };
    case "multi-select":
      return { ...common, type: "multi-select", config: { options: [] } };
    case "radio":
      return { ...common, type: "radio", config: { options: [] } };
    case "checkbox-group":
      return { ...common, type: "checkbox-group", config: { options: [] } };
    case "boolean":
      return { ...common, type: "boolean", config: {} };
    case "segmented":
      return { ...common, type: "segmented", config: { options: [] } };
    case "slider":
      return { ...common, type: "slider", config: { min: 0, max: 10 } };
    case "rating":
      return { ...common, type: "rating", config: {} };
    case "color":
      return { ...common, type: "color", config: {} };
    case "date":
      return { ...common, type: "date", config: {} };
    case "time":
      return { ...common, type: "time", config: {} };
    case "datetime":
      return { ...common, type: "datetime", config: {} };
    case "tags":
      return { ...common, type: "tags", config: {} };
    case "repeatable-group":
      return {
        ...common,
        type: "repeatable-group",
        config: { count: 1, itemLabel: "Item", questions: [] },
      };
  }
}

export function makeNestedQuestion(
  type: Exclude<QuestionType, "repeatable-group">,
  base?: Partial<QuestionBase>,
): NestedQuestion {
  return makeQuestion(type, base) as NestedQuestion;
}
