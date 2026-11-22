import type {
  ExperimentTemplate,
  ReportForm,
  ReportRow,
} from "@/lib/experiment-manager/client";

// The report form's results table: one section per method, each row one of the
// method's calculation results, printed as stored. experiment-manager checks it again.

/** A method of the sample type and the results it can print. */
export interface MethodResults {
  id: string;
  name: string;
  results: string[];
  /** Shown on the web: clients can request it. */
  shown: boolean;
}

interface StoredTemplate {
  labForm?: { dishRun?: { calculations?: { name?: string }[] } | null } | null;
  calculations?: Record<string, unknown> | null;
}

/**
 * A template's calculations that hold one value to print. A dish run's per-dish
 * calculations and accepted_pair hold a value per dish (a list), so only its
 * final_<target> is offered.
 */
export function printableResults(template: unknown): string[] {
  const stored = (template ?? {}) as StoredTemplate;
  const dishRun = stored.labForm?.dishRun;
  const perDish = new Set(
    dishRun
      ? [
          "accepted_pair",
          ...(dishRun.calculations ?? []).map((c) => c.name?.trim() ?? ""),
        ]
      : [],
  );
  return Object.keys(stored.calculations ?? {}).filter((key) => !perDish.has(key));
}

export function methodResults(templates: ExperimentTemplate[]): MethodResults[] {
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    results: printableResults(t.template),
    shown: t.isVisibleOnWeb,
  }));
}

/** A stored table as the editor edits it (a form saved before sections is empty). */
export function storedForm(form: unknown): ReportForm {
  const sections = (form as { sections?: unknown } | null)?.sections;
  if (!Array.isArray(sections)) return { sections: [] };
  return {
    sections: sections.map((s) => ({
      template: String(s.template),
      rows: (s.rows ?? []).map(({ result, label, unit }: ReportRow) => ({
        result,
        ...(label ? { label } : {}),
        ...(unit ? { unit } : {}),
      })),
    })),
  };
}

/**
 * The table with `result` appended to its method's section (a new section goes last).
 * The label starts as the result's name: a section with several rows needs one on each.
 */
export function addRow(form: ReportForm, template: string, result: string): ReportForm {
  const row: ReportRow = { result, label: result };
  if (!form.sections.some((s) => s.template === template)) {
    return { sections: [...form.sections, { template, rows: [row] }] };
  }
  return {
    sections: form.sections.map((s) =>
      s.template !== template || s.rows.some((r) => r.result === result)
        ? s
        : { ...s, rows: [...s.rows, row] },
    ),
  };
}

/** The table without that row; a section left empty goes too. */
export function removeRow(form: ReportForm, template: string, result: string): ReportForm {
  return {
    sections: form.sections
      .map((s) =>
        s.template === template
          ? { ...s, rows: s.rows.filter((r) => r.result !== result) }
          : s,
      )
      .filter((s) => s.rows.length > 0),
  };
}

/** The table with that row's label or unit changed (empty = none). */
export function editRow(
  form: ReportForm,
  template: string,
  result: string,
  change: Partial<Pick<ReportRow, "label" | "unit">>,
): ReportForm {
  return {
    sections: form.sections.map((s) =>
      s.template !== template
        ? s
        : {
            ...s,
            rows: s.rows.map((r) => {
              if (r.result !== result) return r;
              const next: ReportRow = { ...r, ...change };
              if (!next.label) delete next.label;
              if (!next.unit) delete next.unit;
              return next;
            }),
          },
    ),
  };
}

/**
 * The rows of a method's section whose calculation its new version (`after`; null =
 * deleted) no longer has. experiment-manager drops them when the change is saved (or
 * refuses the change while the method has finished experiments).
 */
export function rowsRemoved(
  template: string,
  form: ReportForm,
  after: unknown | null,
): string[] {
  return removedRows(template, form, after).map((r) => r.label || r.result);
}

/** The printed results (calculation names) behind `rowsRemoved`. */
export function resultsRemoved(
  template: string,
  form: ReportForm,
  after: unknown | null,
): string[] {
  return removedRows(template, form, after).map((r) => r.result);
}

function removedRows(template: string, form: ReportForm, after: unknown | null) {
  const calculations = (after as StoredTemplate | null)?.calculations ?? {};
  const kept = new Set(Object.keys(calculations));
  const section = form.sections.find((s) => s.template === template);
  return (section?.rows ?? []).filter((r) => !kept.has(r.result));
}
