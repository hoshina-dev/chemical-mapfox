import type {
  ExperimentTemplate,
  FormDoc,
  NestedQuestion,
  Question,
  QuestionType,
} from "@repo/forms";

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

export function toDraft(
  meta: TemplateMeta,
  template: ExperimentTemplate,
): FormDraft {
  return {
    title: meta.title,
    description: meta.description,
    clientForm: template.clientForm,
    labForm: template.labForm,
    calculations: Object.entries(template.calculations).map(
      ([name, { formula }]) => ({ name, formula }),
    ),
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
