"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import type { ActionResult } from "@/app/actions/onboarding";
import { requireAdmin } from "@/lib/auth/dal";
import { reportFormPath, sampleOnboardingPath } from "@/lib/internal/routes";
import { logHandledError } from "@/lib/log/handled";
import {
  putReportForm,
  type ReportForm,
  experimentManagerMessage,
} from "@/lib/experiment-manager/client";

// experiment-manager checks both parts (PDF safety; each row a printable result of the
// section's method, labels on sections with several rows).

/** Upload (or replace) a sample type's blank report form. The results table is kept. */
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
      error: experimentManagerMessage(error, t("uploadError")),
    };
  }
}

/** Save the results table (the editor's autosave). */
export async function saveReportTableAction(
  sampleId: string,
  form: ReportForm,
): Promise<ActionResult<null>> {
  const session = await requireAdmin();
  try {
    await putReportForm(session.userId, sampleId, { form });
    return { success: true, data: null };
  } catch (error) {
    logHandledError(error, { action: "saveReportTableAction", sampleId });
    const t = await getTranslations("staff.reportForm");
    return {
      success: false,
      error: experimentManagerMessage(error, t("saveError")),
    };
  }
}
