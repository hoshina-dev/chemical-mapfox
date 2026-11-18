import type {
  ExperimentTemplate,
  ReportField,
} from "@/lib/experiment-manager/client";

// What the report form editor offers to place, and the field math. A field's x/y
// are PDF points from the page's top-left corner, y on the text baseline (as
// experiment-manager prints them).

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

/** An experiment's values, by kind, in the order the editor lists them. */
export const EXPERIMENT_KINDS = ["result", "lab", "client"] as const;
export type FieldKind = "general" | (typeof EXPERIMENT_KINDS)[number];

export interface ExperimentFields {
  id: string;
  name: string;
  fields: Record<(typeof EXPERIMENT_KINDS)[number], FieldOption[]>;
}

type StoredQuestions = {
  questions?: { id?: string; label?: string; type?: string }[];
} | null;

interface StoredForm {
  clientForm?: StoredQuestions;
  labForm?: StoredQuestions;
  calculations?: Record<string, unknown> | null;
}

/** Questions with one value each (a repeatable group holds a list: not printable). */
function single(
  form: StoredQuestions | undefined,
  source: (id: string) => string,
): FieldOption[] {
  return (form?.questions ?? [])
    .filter((q) => q.id && q.type !== "repeatable-group")
    .map((q) => ({ source: source(q.id!), label: q.label || q.id! }));
}

/** Each experiment (method) of the sample type with the values it can print. */
export function experimentFields(
  templates: ExperimentTemplate[],
): ExperimentFields[] {
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    fields: methodFields(t.id, t.template),
  }));
}

function methodFields(
  id: string,
  template: unknown,
): ExperimentFields["fields"] {
  const stored = template as StoredForm;
  return {
    result: Object.keys(stored.calculations ?? {}).map((key) => ({
      source: `result.${id}.${key}`,
      label: key,
    })),
    lab: single(stored.labForm, (q) => `labForm.${id}.${q}`),
    client: single(stored.clientForm, (q) => `clientForm.${q}`),
  };
}

/**
 * The placements of a method's results and lab values (`placed`: the report form's
 * sources) that its new version (`after`; null = deleted) no longer has. experiment-manager
 * drops them from the report form when the change is saved (or refuses the change while
 * the method has finished experiments). Labels come from the version before.
 */
export function placementsRemoved(
  templateId: string,
  placed: readonly string[],
  before: unknown,
  after: unknown | null,
): FieldOption[] {
  const own = (f: ExperimentFields["fields"]) => [...f.result, ...f.lab];
  const kept = new Set(
    after === null
      ? []
      : own(methodFields(templateId, after)).map((o) => o.source),
  );
  const labels = new Map(
    own(methodFields(templateId, before)).map((o) => [o.source, o.label]),
  );
  const mine = [`result.${templateId}.`, `labForm.${templateId}.`];
  return [...new Set(placed)]
    .filter((s) => mine.some((p) => s.startsWith(p)) && !kept.has(s))
    .map((source) => ({
      source,
      label: labels.get(source) ?? source.split(".").pop()!,
    }));
}

/** How a placed field is named: "Method · value" for an experiment's own value. */
export function experimentLabels(
  experiments: ExperimentFields[],
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const exp of experiments) {
    for (const kind of EXPERIMENT_KINDS) {
      for (const field of exp.fields[kind])
        labels[field.source] ??= `${exp.name} · ${field.label}`;
    }
  }
  return labels;
}

/** What kind of value a source is (colours the editor). */
export function fieldKind(source: string): FieldKind {
  if (source.startsWith("result.")) return "result";
  if (source.startsWith("labForm.")) return "lab";
  if (source.startsWith("clientForm.")) return "client";
  return "general";
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
 * may still carry size, align or prefix, which experiment-manager no longer accepts.
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
