import type {
  ExperimentTemplate,
  ReportField,
} from "@/lib/sample-tracker/client";

// What the report form editor offers to place, and the field math. A field's x/y
// are PDF points from the page's top-left corner, y on the text baseline (as
// sample_tracker prints them).

/** Report values that come from the ticket, not from one experiment. */
export const GENERAL_SOURCES = [
  "sampleType.name",
  "ticket.description",
  "ticket.receivedAt",
  "experiments.firstStartedAt",
  "experiments.lastFinishedAt",
  "report.publishedAt",
] as const;

export interface FieldOption {
  source: string;
  label: string;
}

export interface ExperimentFields {
  id: string;
  name: string;
  fields: FieldOption[];
}

interface StoredForm {
  clientForm?: {
    questions?: { id?: string; label?: string; type?: string }[];
  } | null;
  calculations?: Record<string, unknown> | null;
}

/** Each experiment (method) of the sample type with the values it can print. */
export function experimentFields(
  templates: ExperimentTemplate[],
): ExperimentFields[] {
  return templates.map((t) => {
    const stored = t.template as StoredForm;
    const questions = (stored.clientForm?.questions ?? []).filter(
      (q) => q.id && q.type !== "repeatable-group",
    );
    return {
      id: t.id,
      name: t.name,
      fields: [
        ...questions.map((q) => ({
          source: `clientForm.${q.id}`,
          label: q.label || q.id!,
        })),
        ...Object.keys(stored.calculations ?? {}).map((key) => ({
          source: `result.${t.id}.${key}`,
          label: key,
        })),
      ],
    };
  });
}

/** How a placed field is named: "Method · value" for an experiment's own value. */
export function experimentLabels(
  experiments: ExperimentFields[],
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const exp of experiments) {
    for (const field of exp.fields)
      labels[field.source] ??= `${exp.name} · ${field.label}`;
  }
  return labels;
}

export interface PageSize {
  width: number;
  height: number;
}

const round = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max);

/** A field at a point of the page, printed with the defaults (size 10, left). */
export function placeField(
  source: string,
  page: number,
  x: number,
  y: number,
  size: PageSize,
): ReportField {
  return {
    page,
    x: round(clamp(x, size.width)),
    y: round(clamp(y, size.height)),
    source,
  };
}

/**
 * A stored map's fields as the editor saves them. Maps made before the fixed format
 * may still carry size, align or prefix, which sample_tracker no longer accepts.
 */
export function storedFields(fields: readonly ReportField[]): ReportField[] {
  return fields.map(({ page, x, y, source }) => ({ page, x, y, source }));
}

/** The field moved by dx/dy points, kept on the page. */
export function moveField(
  field: ReportField,
  dx: number,
  dy: number,
  size: PageSize,
): ReportField {
  return {
    ...field,
    x: round(clamp(field.x + dx, size.width)),
    y: round(clamp(field.y + dy, size.height)),
  };
}
