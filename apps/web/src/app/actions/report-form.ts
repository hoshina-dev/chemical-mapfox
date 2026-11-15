"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import type { ActionResult } from "@/app/actions/onboarding";
import { requireAdmin } from "@/lib/auth/dal";
import { reportFormPath, sampleOnboardingPath } from "@/lib/internal/routes";
import { logHandledError } from "@/lib/log/handled";
import {
  putReportForm,
  type ReportField,
  sampleTrackerMessage,
} from "@/lib/sample-tracker/client";

// sample_tracker checks both parts (PDF safety, pages, known sources).

/** Upload (or replace) a sample type's blank report form. Placed fields are kept. */
export async function uploadReportFormPdfAction(
  sampleId: string,
  form: FormData,
): Promise<ActionResult<null>> {
  const session = await requireAdmin();
  const t = await getTranslations("staff.reportForm");
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return { success: false, error: t("missing") };
  }
  try {
    await putReportForm(session.userId, sampleId, { pdf: file });
    revalidatePath(reportFormPath(sampleId));
    revalidatePath(sampleOnboardingPath(sampleId));
    return { success: true, data: null };
  } catch (error) {
    logHandledError(error, { action: "uploadReportFormPdfAction", sampleId });
    return {
      success: false,
      error: sampleTrackerMessage(error, t("uploadError")),
    };
  }
}

/** Save where each value is printed on the stored blank form (the editor's autosave). */
export async function saveReportFieldsAction(
  sampleId: string,
  fields: ReportField[],
): Promise<ActionResult<null>> {
  const session = await requireAdmin();
  try {
    await putReportForm(session.userId, sampleId, {
      fields: JSON.stringify({ fields }),
    });
    return { success: true, data: null };
  } catch (error) {
    logHandledError(error, { action: "saveReportFieldsAction", sampleId });
    const t = await getTranslations("staff.reportForm");
    return {
      success: false,
      error: sampleTrackerMessage(error, t("saveError")),
    };
  }
}
