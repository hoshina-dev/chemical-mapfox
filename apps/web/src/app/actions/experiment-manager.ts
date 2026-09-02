"use server";

import type { AnswerValue, ExperimentTemplate } from "@repo/forms";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth/dal";
import { logHandledError } from "@/lib/log/handled";
import {
  type CalculationDryRunResponse,
  createExperimentTemplate,
  createSample,
  deleteExperimentTemplate,
  evaluateCalculations,
  updateExperimentTemplate,
} from "@/lib/experiment-manager/client";
import { errorMessage } from "@/lib/experiment-manager/errors";
import {
  templateToCalculationDryRun,
  templateToCreate,
  templateToUpdate,
  type TemplateRef,
} from "@/lib/experiment-manager/mappers";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

interface TemplatePayload {
  meta: { title: string; description?: string };
  template: ExperimentTemplate;
}

export async function createSampleAction(
  name: string,
  description?: string,
): Promise<ActionResult<{ id: string; name: string }>> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) {
    const t = await getTranslations("staff.registerSample");
    return { success: false, error: t("nameRequired") };
  }
  try {
    const sample = await createSample({
      name: trimmed,
      description: description?.trim() || null,
    });
    revalidatePath("/internal/experiment/onboarding");
    return { success: true, data: { id: sample.id, name: sample.name } };
  } catch (error) {
    logHandledError(error, { action: "createSampleAction" });
    const t = await getTranslations("builder.errors");
    return { success: false, error: errorMessage(error, t("createSample")) };
  }
}

export async function createTemplateAction(
  sampleId: string,
  { meta, template }: TemplatePayload,
): Promise<ActionResult<{ id: string; lineageId: string }>> {
  await requireAdmin();
  try {
    const detail = await createExperimentTemplate(
      sampleId,
      templateToCreate(meta, template),
    );
    revalidatePath("/internal/experiment/onboarding");
    return {
      success: true,
      data: { id: detail.id, lineageId: detail.lineage_id },
    };
  } catch (error) {
    logHandledError(error, { action: "createTemplateAction", sampleId });
    const t = await getTranslations("builder.errors");
    return {
      success: false,
      error: errorMessage(error, t("createTemplate")),
    };
  }
}

export async function updateTemplateAction(
  ref: TemplateRef,
  { meta, template }: TemplatePayload,
  lineageId: string,
): Promise<ActionResult<{ id: string; lineageId: string }>> {
  await requireAdmin();
  try {
    const detail = await updateExperimentTemplate(
      ref.sampleId,
      lineageId,
      templateToUpdate(meta, template),
    );
    revalidatePath("/internal/experiment/onboarding");
    revalidatePath(
      `/internal/experiment/onboarding/${ref.sampleId}/${ref.templateId}`,
    );
    return {
      success: true,
      data: { id: detail.id, lineageId: detail.lineage_id },
    };
  } catch (error) {
    logHandledError(error, {
      action: "updateTemplateAction",
      sampleId: ref.sampleId,
    });
    const t = await getTranslations("builder.errors");
    return {
      success: false,
      error: errorMessage(error, t("saveTemplate")),
    };
  }
}

export async function deleteTemplateAction(
  ref: TemplateRef,
): Promise<ActionResult<null>> {
  await requireAdmin();
  try {
    await deleteExperimentTemplate(ref.sampleId, ref.templateId);
    revalidatePath("/internal/experiment/onboarding");
    return { success: true, data: null };
  } catch (error) {
    logHandledError(error, {
      action: "deleteTemplateAction",
      sampleId: ref.sampleId,
    });
    const t = await getTranslations("builder.errors");
    return {
      success: false,
      error: errorMessage(error, t("deleteTemplate")),
    };
  }
}

/**
 * Run the draft template's formulas against trial answers. Persists nothing, so
 * there is no path to revalidate — a failed result here means the request
 * itself failed, not that a formula was wrong (per-formula errors come back
 * inside a successful response).
 */
export async function testCalculationsAction(
  template: ExperimentTemplate,
  values: Record<string, AnswerValue>,
): Promise<ActionResult<CalculationDryRunResponse>> {
  await requireAdmin();
  try {
    const result = await evaluateCalculations(
      templateToCalculationDryRun(template, values),
    );
    return { success: true, data: result };
  } catch (error) {
    logHandledError(error, {
      action: "testCalculationsAction",
      service: "experiment-manager",
    });
    const t = await getTranslations("builder.errors");
    return {
      success: false,
      error: errorMessage(error, t("testCalculations")),
    };
  }
}
