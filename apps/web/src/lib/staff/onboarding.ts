import "server-only";

import type { ExperimentTemplate, FormAnswers } from "@repo/forms";
import { ExperimentTemplate as ExperimentTemplateSchema } from "@repo/forms";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/actions/experiment-manager";
import type { PdfComp } from "@/components/experiment/pdf-editor/types";
import {
  createExperimentTemplate,
  createSample,
  evaluateCalculations,
  getExperimentTemplate,
  listExperimentTemplates,
  listSamples,
  setSampleWebVisibility,
  setTemplateWebVisibility,
  updateExperimentTemplate,
  upsertPdfTemplate,
  type CalculationDryRunResponse,
} from "@/lib/experiment-manager/client";
import { errorMessage } from "@/lib/experiment-manager/errors";
import {
  templateDetailToLoaded,
  templateToCalculationDryRun,
  templateToCreate,
} from "@/lib/experiment-manager/mappers";
import { logHandledError } from "@/lib/log/handled";

import { inspectFormulas, standInValues } from "./formulas";

const PAGE_W = 612;
const PAGE_H = 792;

export interface OnboardInput {
  sampleId?: string;
  sampleName?: string;
  sampleDescription?: string;
  title: string;
  description?: string;
  /** Revise this lineage instead of creating a new template. */
  lineageId?: string;
  template: ExperimentTemplate;
  /** Real answers to dry-run with. Stand-ins fill anything omitted. */
  trialValues?: FormAnswers;
  /**
   * Clients cannot request a method without a PDF layout. Omitted: write a
   * plain one only if the method has none, so a revision keeps a designed
   * layout (experiment-manager copies it to the new version). true replaces it.
   */
  reportLayout?: boolean;
  /** Default false. Also shows the sample on the public catalogue. */
  publish?: boolean;
}

export interface OnboardedTemplate {
  sampleId: string;
  sampleName: string;
  createdSample: boolean;
  templateId: string;
  lineageId: string;
  /** kept: the revision inherited the method's existing layout. */
  reportLayout: "written" | "kept" | "none";
  published: boolean;
  /** Dry run against stand-in or trial answers. Not a real result. */
  formulaCheck: CalculationDryRunResponse | null;
  warning?: string;
}

function refresh(sampleId: string) {
  revalidatePath("/internal/experiment/onboarding");
  revalidatePath(`/internal/experiment/onboarding/${sampleId}`);
  revalidatePath("/");
  revalidatePath("/experiment/request/listing");
}

async function failure(error: unknown, fallback: string, context: Record<string, unknown>): Promise<ActionResult<never>> {
  logHandledError(error, context);
  return { success: false, error: errorMessage(error, fallback) };
}

export async function listOnboardingSamples(): Promise<
  ActionResult<{ id: string; name: string; description: string | null; visible: boolean }[]>
> {
  try {
    const { samples } = await listSamples();
    return {
      success: true,
      data: samples.map((sample) => ({
        id: sample.id,
        name: sample.name,
        description: sample.description ?? null,
        visible: sample.is_visible_on_web,
      })),
    };
  } catch (error) {
    return failure(error, "Could not list samples.", { op: "listOnboardingSamples" });
  }
}

export async function listOnboardingTemplates(sampleId: string): Promise<
  ActionResult<
    {
      templateId: string;
      lineageId: string;
      title: string;
      description: string | null;
      version: number;
      current: boolean;
      hasPdfTemplate: boolean;
      visible: boolean;
    }[]
  >
> {
  try {
    const { experiments } = await listExperimentTemplates(sampleId);
    return {
      success: true,
      data: experiments.map((template) => ({
        templateId: template.id,
        lineageId: template.lineage_id,
        title: template.name,
        description: template.description ?? null,
        version: template.version,
        current: template.is_current,
        hasPdfTemplate: template.has_pdf_template,
        visible: template.is_visible_on_web,
      })),
    };
  } catch (error) {
    return failure(error, "Could not list templates.", { op: "listOnboardingTemplates", sampleId });
  }
}

export async function getOnboardingTemplate(
  sampleId: string,
  templateId: string,
): Promise<
  ActionResult<{
    templateId: string;
    lineageId: string;
    title: string;
    description: string | null;
    version: number;
    hasPdfTemplate: boolean;
    visible: boolean;
    template: ExperimentTemplate;
  }>
> {
  try {
    const detail = await getExperimentTemplate(sampleId, templateId);
    const loaded = templateDetailToLoaded(detail);
    return {
      success: true,
      data: {
        templateId: loaded.id,
        lineageId: loaded.lineageId,
        title: loaded.meta.title,
        description: loaded.meta.description ?? null,
        version: detail.version,
        hasPdfTemplate: detail.has_pdf_template,
        visible: detail.is_visible_on_web,
        template: {
          clientForm: loaded.template.clientForm,
          labForm: loaded.template.labForm,
          calculations: Object.fromEntries(
            Object.entries(loaded.template.calculations).map(([name, calc]) => [
              name,
              { formula: calc.formula },
            ]),
          ),
        },
      },
    };
  } catch (error) {
    return failure(error, "Could not load this template.", {
      op: "getOnboardingTemplate",
      sampleId,
      templateId,
    });
  }
}

export async function createOnboardingSample(
  name: string,
  description?: string,
): Promise<ActionResult<{ id: string; name: string }>> {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Sample name is required." };
  try {
    const sample = await createSample({
      name: trimmed,
      description: description?.trim() || null,
    });
    refresh(sample.id);
    return { success: true, data: { id: sample.id, name: sample.name } };
  } catch (error) {
    return failure(error, "Could not create this sample.", { op: "createOnboardingSample" });
  }
}

export async function testOnboardingCalculations(
  template: ExperimentTemplate,
  values: FormAnswers,
): Promise<ActionResult<CalculationDryRunResponse>> {
  const parsed = ExperimentTemplateSchema.safeParse(template);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((issue) => issue.message).join("\n") };
  }
  const issues = inspectFormulas(parsed.data);
  if (issues.length > 0) {
    return { success: false, error: issues.map((issue) => issue.message).join("\n") };
  }
  try {
    const result = await evaluateCalculations(
      templateToCalculationDryRun(parsed.data, standInValues(parsed.data, values)),
    );
    return { success: true, data: result };
  } catch (error) {
    return failure(error, "Could not test these formulas.", { op: "testOnboardingCalculations" });
  }
}

const TEXT_STYLE = {
  font: "Helvetica",
  size: 11,
  bold: false,
  italic: false,
  align: "left" as const,
  color: "#111111",
};

/** One text line per field. Enough of a layout that a client can request the method. */
export function simpleReportLayout(title: string, lines: string[]): PdfComp[] {
  const components: PdfComp[] = [];
  let y = PAGE_H - 54;
  const push = (content: string, size = 11) => {
    if (y < 36) {
      components.push({ id: `break-${components.length}`, type: "pagebreak" });
      y = PAGE_H - 54;
    }
    components.push({
      id: `line-${components.length}`,
      type: "text",
      content,
      rect: [36, y, PAGE_W - 72, size + 4],
      style: { ...TEXT_STYLE, size, bold: size > 11 },
    });
    y -= size + 10;
  };
  push(title, 16);
  for (const line of lines) push(line);
  return components;
}

function reportLines(template: ExperimentTemplate): string[] {
  const lines: string[] = [];
  const add = (questions: ExperimentTemplate["labForm"]["questions"]) => {
    for (const question of questions) {
      if (question.type === "repeatable-group") {
        for (const child of question.config.questions) {
          lines.push(`${question.label} — ${child.label}: {{${child.id}}}`);
        }
      } else {
        lines.push(`${question.label}: {{${question.id}}}`);
      }
    }
  };
  add(template.clientForm.questions);
  add(template.labForm.questions);
  for (const name of Object.keys(template.calculations)) {
    lines.push(`${name}: {{${name}}}`);
  }
  return lines;
}

function formulasOnly(template: ExperimentTemplate): ExperimentTemplate {
  return {
    ...template,
    calculations: Object.fromEntries(
      Object.entries(template.calculations).map(([name, calc]) => [name, { formula: calc.formula }]),
    ),
  };
}

async function resolveSample(
  input: OnboardInput,
): Promise<ActionResult<{ id: string; name: string; created: boolean }>> {
  if (input.sampleId) {
    const listed = await listSamples();
    const sample = listed.samples.find((item) => item.id === input.sampleId);
    if (!sample) return { success: false, error: `No sample with id ${input.sampleId}.` };
    return { success: true, data: { id: sample.id, name: sample.name, created: false } };
  }
  const name = input.sampleName?.trim();
  if (!name) return { success: false, error: "Give sampleId or sampleName." };
  const listed = await listSamples();
  const matches = listed.samples.filter((item) => item.name.trim().toLowerCase() === name.toLowerCase());
  if (matches.length > 1) {
    return {
      success: false,
      error: `More than one sample is named '${name}': ${matches.map((item) => item.id).join(", ")}. Pass sampleId.`,
    };
  }
  const existing = matches[0];
  if (existing) return { success: true, data: { id: existing.id, name: existing.name, created: false } };
  const created = await createSample({
    name,
    description: input.sampleDescription?.trim() || null,
  });
  return { success: true, data: { id: created.id, name: created.name, created: true } };
}

function formulaCheckFailed(result: CalculationDryRunResponse): string | null {
  const lines: string[] = [];
  for (const [name, outcome] of Object.entries(result.calculations)) {
    if (outcome.status === "ok") continue;
    lines.push(outcome.error?.message ?? `${name} ${outcome.status}`);
  }
  if (result.duplicate_question_ids.length > 0) {
    lines.push(`Duplicate question ids: ${result.duplicate_question_ids.join(", ")}.`);
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

/**
 * Create or revise a template from a spreadsheet the caller already read.
 * Formulas are checked the way experiment-manager runs them, and nothing is
 * saved when that check fails.
 */
export async function onboardTemplate(input: OnboardInput): Promise<ActionResult<OnboardedTemplate>> {
  const parsed = ExperimentTemplateSchema.safeParse(input.template);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"),
    };
  }
  const template = formulasOnly(parsed.data);
  const issues = inspectFormulas(template);
  if (issues.length > 0) {
    return { success: false, error: issues.map((issue) => issue.message).join("\n") };
  }

  let formulaCheck: CalculationDryRunResponse | null = null;
  if (Object.keys(template.calculations).length > 0) {
    try {
      formulaCheck = await evaluateCalculations(
        templateToCalculationDryRun(template, standInValues(template, input.trialValues)),
      );
    } catch (error) {
      return failure(error, "Could not test these formulas.", { op: "onboardTemplate.dryRun" });
    }
    const failed = formulaCheckFailed(formulaCheck);
    if (failed) return { success: false, error: failed };
  }

  const meta = { title: input.title.trim(), description: input.description?.trim() };
  if (!meta.title) return { success: false, error: "Template title is required." };

  let sample: { id: string; name: string; created: boolean };
  try {
    const resolved = await resolveSample(input);
    if (!resolved.success) return resolved;
    sample = resolved.data;
  } catch (error) {
    return failure(error, "Could not find or create the sample.", { op: "onboardTemplate.sample" });
  }

  let templateId: string;
  let lineageId: string;
  let hadLayout: boolean;
  try {
    const detail = input.lineageId
      ? await updateExperimentTemplate(sample.id, input.lineageId, templateToCreate(meta, template))
      : await createExperimentTemplate(sample.id, templateToCreate(meta, template));
    templateId = detail.id;
    lineageId = detail.lineage_id;
    hadLayout = detail.has_pdf_template;
  } catch (error) {
    return failure(error, "Could not save this template.", { op: "onboardTemplate.template", sampleId: sample.id });
  }

  const warnings: string[] = [];
  const wantLayout = input.reportLayout ?? !hadLayout;
  let layout: OnboardedTemplate["reportLayout"] = hadLayout ? "kept" : "none";
  if (wantLayout) {
    try {
      const pdf = await upsertPdfTemplate(
        sample.id,
        lineageId,
        simpleReportLayout(meta.title, reportLines(template)),
      );
      templateId = pdf.template_id;
      layout = "written";
    } catch (error) {
      logHandledError(error, { op: "onboardTemplate.pdf", sampleId: sample.id });
      warnings.push(errorMessage(error, "The template was saved, but the PDF layout was not."));
    }
  }

  let published = false;
  if (input.publish === true && warnings.length === 0) {
    try {
      await setSampleWebVisibility(sample.id, true);
      await setTemplateWebVisibility(sample.id, lineageId, true);
      published = true;
    } catch (error) {
      logHandledError(error, { op: "onboardTemplate.publish", sampleId: sample.id });
      warnings.push(errorMessage(error, "The template was saved, but it was not published."));
    }
  }

  refresh(sample.id);
  return {
    success: true,
    data: {
      sampleId: sample.id,
      sampleName: sample.name,
      createdSample: sample.created,
      templateId,
      lineageId,
      reportLayout: layout,
      published,
      formulaCheck,
      warning: warnings.join("\n") || undefined,
    },
  };
}

/**
 * Show or hide a sample, or one of its methods, on the public catalogue. A
 * method only shows when its sample is visible too.
 */
export async function setCatalogueVisibility(
  sampleId: string,
  lineageId: string | undefined,
  visible: boolean,
): Promise<ActionResult<{ sampleId: string; lineageId: string | null; visible: boolean }>> {
  try {
    if (lineageId) await setTemplateWebVisibility(sampleId, lineageId, visible);
    else await setSampleWebVisibility(sampleId, visible);
    refresh(sampleId);
    return { success: true, data: { sampleId, lineageId: lineageId ?? null, visible } };
  } catch (error) {
    return failure(error, "Could not change catalogue visibility.", {
      op: "setCatalogueVisibility",
      sampleId,
      lineageId,
    });
  }
}
