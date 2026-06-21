"use server";

import type { ExperimentTemplate } from "@repo/forms";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import {
  createExperimentTemplate,
  createSample,
  deleteExperimentTemplate,
  updateExperimentTemplate,
} from "@/lib/experiment-manager/client";
import { errorMessage } from "@/lib/experiment-manager/errors";
import {
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
    return { success: false, error: "Sample name is required." };
  }
  try {
    const sample = await createSample({
      name: trimmed,
      description: description?.trim() || null,
    });
    revalidatePath("/internal/experiment/onboarding");
    return { success: true, data: { id: sample.id, name: sample.name } };
  } catch (error) {
    return { success: false, error: errorMessage(error, "Could not create sample.") };
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
    return {
      success: false,
      error: errorMessage(error, "Could not create template."),
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
    return {
      success: false,
      error: errorMessage(error, "Could not save template."),
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
    return {
      success: false,
      error: errorMessage(error, "Could not delete template."),
    };
  }
}
