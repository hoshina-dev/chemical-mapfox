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

export const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "string", label: "Text (short answer)" },
  { value: "textarea", label: "Paragraph" },
  { value: "password", label: "Password" },
  { value: "number", label: "Number" },
  { value: "select-string", label: "Dropdown (text values)" },
  { value: "select-number", label: "Dropdown (number values)" },
  { value: "multi-select", label: "Multi-select dropdown" },
  { value: "radio", label: "Radio (multiple choice)" },
  { value: "checkbox-group", label: "Checkboxes (multi)" },
  { value: "boolean", label: "Yes/No switch" },
  { value: "segmented", label: "Segmented control" },
  { value: "slider", label: "Slider (linear scale)" },
  { value: "rating", label: "Star rating" },
  { value: "color", label: "Color" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "datetime", label: "Date & time" },
  { value: "tags", label: "Tags" },
  { value: "repeatable-group", label: "Repeatable group" },
];

export const NESTED_QUESTION_TYPE_OPTIONS = QUESTION_TYPE_OPTIONS.filter(
  (o) => o.value !== "repeatable-group",
);

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
