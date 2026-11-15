"use server";

import type { ExperimentTemplate } from "@repo/forms";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/auth/dal";
import { logHandledError } from "@/lib/log/handled";
import type { TemplateRef } from "@/lib/experiment-manager/mappers";
import {
  createSampleType,
  createTemplate,
  deleteTemplate,
  sampleTrackerMessage as errorMessage,
  updateTemplate,
} from "@/lib/sample-tracker/client";
import { templateBody } from "@/lib/sample-tracker/mappers";

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
  const session = await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) {
    const t = await getTranslations("staff.registerSample");
    return { success: false, error: t("nameRequired") };
  }
  try {
    const sample = await createSampleType(session.userId, {
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
  const session = await requireAdmin();
  try {
    const detail = await createTemplate(
      session.userId,
      sampleId,
      templateBody(meta, template),
    );
    revalidatePath("/internal/experiment/onboarding");
    return { success: true, data: { id: detail.id, lineageId: detail.id } };
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
): Promise<ActionResult<{ id: string; lineageId: string }>> {
  const session = await requireAdmin();
  try {
    const detail = await updateTemplate(
      session.userId,
      ref.templateId,
      templateBody(meta, template),
    );
    revalidatePath("/internal/experiment/onboarding");
    revalidatePath(
      `/internal/experiment/onboarding/${ref.sampleId}/${ref.templateId}`,
    );
    return { success: true, data: { id: detail.id, lineageId: detail.id } };
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
  const session = await requireAdmin();
  try {
    await deleteTemplate(session.userId, ref.templateId);
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

function refreshCatalogues(sampleId?: string) {
  revalidatePath("/");
  revalidatePath("/experiment/request/listing");
  revalidatePath("/internal/experiment/onboarding");
  if (sampleId) revalidatePath(`/internal/experiment/onboarding/${sampleId}`);
}

export async function setCatalogueVisibilityAction(
  id: string,
  visible: boolean,
  sampleId?: string,
): Promise<ActionResult<null>> {
  await requireAdmin();
  // TODO(catalogue visibility): sample_tracker has no visibility yet (last step of
  // the switch-over); until then everything is shown.
  void id;
  void visible;
  refreshCatalogues(sampleId);
  const t = await getTranslations("staff.catalogue");
  return { success: false, error: t("saveError") };
}

export async function setCatalogueOrderAction(
  ids: string[],
  sampleId?: string,
): Promise<ActionResult<null>> {
  await requireAdmin();
  // TODO(catalogue order): sample_tracker has no order yet (last step of the
  // switch-over); until then lists are sorted by name.
  void ids;
  refreshCatalogues(sampleId);
  const t = await getTranslations("staff.catalogue");
  return { success: false, error: t("saveError") };
}
