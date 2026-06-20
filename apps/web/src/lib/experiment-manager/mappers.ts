import type {
  AnswerValue,
  ExperimentTemplate,
  FormDoc,
  Question,
} from "@repo/forms";
import { ExperimentTemplate as ExperimentTemplateSchema } from "@repo/forms";

import type {
  CalculationSnapshot,
  ExperimentDetail,
  ExperimentTemplateCreate,
  ExperimentTemplateDetail,
  ExperimentTemplateSummary,
  ExperimentTemplateUpdate,
  FormDocSnapshot,
} from "./client";

/** Composite key — templates are addressed by sample + template id. */
export interface TemplateRef {
  sampleId: string;
  templateId: string;
}

export interface TemplateSummary {
  sampleId: string;
  templateId: string;
  lineageId: string;
  title: string;
  description?: string;
}

export interface LoadedTemplate {
  id: string;
  lineageId: string;
  meta: { title: string; description?: string };
  template: ExperimentTemplate;
  valid: boolean;
}

type CalculationWire = CalculationSnapshot | string;

function stripNullFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripNullFields);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== null)
        .map(([key, entryValue]) => [key, stripNullFields(entryValue)]),
    );
  }
  return value;
}

function hasWireResult(result: unknown): boolean {
  return result !== undefined && result !== null && result !== "";
}

function readFormDoc(
  detail: {
    clientForm?: FormDocSnapshot | null;
    labForm?: FormDocSnapshot | null;
  },
  kind: "client" | "lab",
): FormDocSnapshot {
  if (kind === "client") {
    return detail.clientForm ?? { title: "", questions: [] };
  }
  return detail.labForm ?? { title: "", questions: [] };
}

export function normalizeCalculations(
  calcs: Record<string, CalculationWire> | undefined,
): ExperimentTemplate["calculations"] {
  if (!calcs) return {};
  return Object.fromEntries(
    Object.entries(calcs).map(([name, entry]) => {
      if (typeof entry === "string") {
        return [name, { formula: entry }];
      }
      if (
        entry &&
        typeof entry === "object" &&
        typeof entry.formula === "string"
      ) {
        const result = hasWireResult(entry.result) ? entry.result : undefined;
        return [
          name,
          result !== undefined
            ? { formula: entry.formula, result: result as never }
            : { formula: entry.formula },
        ];
      }
      return [name, { formula: "" }];
    }),
  );
}

export function mapCalculationsToApi(
  calcs: ExperimentTemplate["calculations"],
): Record<string, CalculationSnapshot> {
  return Object.fromEntries(
    Object.entries(calcs).map(([name, { formula, result }]) => [
      name,
      result !== undefined ? { formula, result } : { formula },
    ]),
  );
}

export function templateDetailToLoaded(
  detail: ExperimentTemplateDetail,
): LoadedTemplate {
  const candidate = stripNullFields({
    clientForm: readFormDoc(detail, "client"),
    labForm: readFormDoc(detail, "lab"),
    calculations: normalizeCalculations(detail.calculations),
  });
  const parsed = ExperimentTemplateSchema.safeParse(candidate);
  const meta = {
    title: detail.name,
    description:
      typeof detail.description === "string" ? detail.description : undefined,
  };
  return {
    id: detail.id,
    lineageId: detail.lineage_id,
    meta,
    template: parsed.success ? parsed.data : (candidate as ExperimentTemplate),
    valid: parsed.success,
  };
}

/** The current state of an experiment (context): its forms + entered values. */
export interface ExperimentState {
  id: string;
  sampleId: string;
  templateId: string;
  reportStatus: string | null;
  reportGeneratedAt: string | null;
  createdAt: string;
  template: ExperimentTemplate;
  /** Whether the embedded forms parsed cleanly against the form schema. */
  valid: boolean;
  values: Record<string, AnswerValue>;
}

export function experimentDetailToState(
  detail: ExperimentDetail,
): ExperimentState {
  const candidate = stripNullFields({
    clientForm: readFormDoc(detail, "client"),
    labForm: readFormDoc(detail, "lab"),
    calculations: normalizeCalculations(detail.calculations),
  });
  const parsed = ExperimentTemplateSchema.safeParse(candidate);
  return {
    id: detail.id,
    sampleId: detail.sample_id,
    templateId: detail.template_id,
    reportStatus: detail.report_status ?? null,
    reportGeneratedAt: detail.report_generated_at ?? null,
    createdAt: detail.created_at,
    template: parsed.success ? parsed.data : (candidate as ExperimentTemplate),
    valid: parsed.success,
    values: (detail.values ?? {}) as Record<string, AnswerValue>,
  };
}

/**
 * experiment-manager validates the template JSON against a JSON Schema in which
 * `description` must be a string. Optional descriptions omitted by the builder
 * arrive as `null` (the backend's Pydantic models default them to None), which
 * the schema rejects. Coerce every form/question description to a string so
 * templates validate. (Question `required` is defaulted server-side, so only
 * description needs this.)
 */
function normalizeFormDocForApi(doc: FormDoc): FormDocSnapshot {
  const questions = doc.questions.map((question: Question) => {
    const normalized: Record<string, unknown> = {
      ...question,
      description: question.description ?? "",
    };
    if (question.type === "repeatable-group") {
      normalized.config = {
        ...question.config,
        questions: question.config.questions.map((child) => ({
          ...child,
          description: child.description ?? "",
        })),
      };
    }
    return normalized;
  });

  return {
    title: doc.title,
    description: doc.description ?? "",
    questions,
  } as FormDocSnapshot;
}

export function templateToCreate(
  meta: { title: string; description?: string },
  template: ExperimentTemplate,
): ExperimentTemplateCreate {
  return {
    title: meta.title,
    description: meta.description ?? null,
    clientForm: normalizeFormDocForApi(template.clientForm),
    labForm: normalizeFormDocForApi(template.labForm),
    calculations: mapCalculationsToApi(template.calculations),
  };
}

export function templateToUpdate(
  meta: { title: string; description?: string },
  template: ExperimentTemplate,
): ExperimentTemplateUpdate {
  return templateToCreate(meta, template);
}

export function toTemplateSummary(
  sampleId: string,
  row: ExperimentTemplateSummary,
): TemplateSummary {
  return {
    sampleId,
    templateId: row.id,
    lineageId: row.lineage_id,
    title: row.name,
    description: row.description ?? undefined,
  };
}
