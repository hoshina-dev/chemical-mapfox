"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import type { ActionResult } from "@/app/actions/experiment-manager";
import { requireAdmin } from "@/lib/auth/dal";
import { reportFormPath } from "@/lib/experiment-manager/routes";
import { logHandledError } from "@/lib/log/handled";
import { putReportForm, sampleTrackerMessage } from "@/lib/sample-tracker/client";

/**
 * Upload a sample type's blank report form (PDF) and its field map. sample_tracker
 * checks both (PDF safety, known sources) and replaces the stored ones.
 */
export async function uploadReportFormAction(
  sampleId: string,
  form: FormData,
): Promise<ActionResult<{ fields: number }>> {
  const session = await requireAdmin();
  const t = await getTranslations("staff.reportForm");
  const file = form.get("file");
  const fields = form.get("fields");
  if (!(file instanceof Blob) || file.size === 0 || typeof fields !== "string") {
    return { success: false, error: t("missing") };
  }
  try {
    const saved = await putReportForm(session.userId, sampleId, file, fields);
    revalidatePath(reportFormPath(sampleId));
    return { success: true, data: { fields: saved.reportForm?.fields.length ?? 0 } };
  } catch (error) {
    logHandledError(error, { action: "uploadReportFormAction", sampleId });
    return { success: false, error: sampleTrackerMessage(error, t("uploadError")) };
  }
}
