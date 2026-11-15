import type { AnswerValue, Calculation, ExperimentTemplate, FormDoc } from "@repo/forms";
import { ExperimentTemplate as ExperimentTemplateSchema } from "@repo/forms";

import type { CalculationDryRunRequest } from "@/lib/calculations/types";

// View models of templates and experiments, and the parsing of their stored
// `{clientForm, labForm, calculations}` JSON (sample_tracker keeps it as the
// experiment schema describes).

/** Templates are addressed by sample type + template id. */
export interface TemplateRef {
  sampleId: string;
  templateId: string;
}

/** A template row of the onboarding tables. */
export interface TemplateSummary {
  sampleId: string;
  templateId: string;
  lineageId: string;
  title: string;
  description?: string;
  isVisibleOnWeb: boolean;
  displayOrder: number;
}

/** The forms and formulas as stored, unparsed. */
export interface TemplateWireSnapshot {
  clientForm: FormDoc;
  labForm: FormDoc;
  calculations: Record<string, Calculation | string>;
}

export interface LoadedTemplate {
  id: string;
  lineageId: string;
  meta: { title: string; description?: string };
  template: ExperimentTemplate;
  wireSnapshot: TemplateWireSnapshot;
  valid: boolean;
}

/** The current state of an experiment: its frozen forms + entered values. */
export interface ExperimentState {
  id: string;
  sampleId: string;
  templateId: string;
  reportStatus: string | null;
  reportGeneratedAt: string | null;
  createdAt: string;
  template: ExperimentTemplate;
  wireSnapshot: TemplateWireSnapshot;
  /** Whether the embedded forms parsed cleanly against the form schema. */
  valid: boolean;
  values: Record<string, AnswerValue>;
}

function stripNullFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNullFields);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, stripNullFields(v)]),
    );
  }
  return value;
}

const hasResult = (result: unknown) => result !== undefined && result !== null && result !== "";

function normalizeCalculations(
  calcs: Record<string, Calculation | string>,
): ExperimentTemplate["calculations"] {
  return Object.fromEntries(
    Object.entries(calcs).map(([name, entry]) => {
      if (typeof entry === "string") return [name, { formula: entry }];
      if (entry && typeof entry === "object" && typeof entry.formula === "string") {
        return [
          name,
          hasResult(entry.result) ? { formula: entry.formula, result: entry.result } : { formula: entry.formula },
        ];
      }
      return [name, { formula: "" }];
    }),
  );
}

/** A template or experiment context as stored (JSON from the backend). */
export interface StoredTemplate {
  clientForm?: FormDoc | null;
  labForm?: FormDoc | null;
  calculations?: Record<string, Calculation | string> | null;
}

/**
 * Parse stored `{clientForm, labForm, calculations}` into a form template. When it
 * doesn't match the schema, the template is best-effort and `valid` is false.
 */
export function parseTemplate(raw: StoredTemplate): { template: ExperimentTemplate; wireSnapshot: TemplateWireSnapshot; valid: boolean } {
  const wireSnapshot: TemplateWireSnapshot = {
    clientForm: raw.clientForm ?? { name: "", questions: [] },
    labForm: raw.labForm ?? { name: "", questions: [] },
    calculations: raw.calculations ?? {},
  };
  const candidate = stripNullFields({
    clientForm: wireSnapshot.clientForm,
    labForm: wireSnapshot.labForm,
    calculations: normalizeCalculations(wireSnapshot.calculations),
  });
  const parsed = ExperimentTemplateSchema.safeParse(candidate);
  return {
    template: parsed.success ? parsed.data : (candidate as ExperimentTemplate),
    wireSnapshot,
    valid: parsed.success,
  };
}

/** Calculations for saving: results only where there is one. */
export function mapCalculationsToApi(
  calcs: ExperimentTemplate["calculations"],
): Record<string, Calculation> {
  return Object.fromEntries(
    Object.entries(calcs).map(([name, { formula, result }]) => [
      name,
      result !== undefined ? { formula, result } : { formula },
    ]),
  );
}

/**
 * The engine's dry-run body from an unsaved builder draft plus the answers
 * captured in the preview. Previous results are left out: the point is what the
 * formulas produce now.
 */
export function templateToCalculationDryRun(
  template: ExperimentTemplate,
  values: Record<string, AnswerValue>,
): CalculationDryRunRequest {
  return {
    clientForm: template.clientForm,
    labForm: template.labForm,
    calculations: Object.fromEntries(
      Object.entries(template.calculations).map(([name, { formula }]) => [name, { formula }]),
    ),
    values,
  };
}
