import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/dal";
import { getReportForm, ExperimentManagerError } from "@/lib/experiment-manager/client";
import { pdfResponse } from "@/lib/experiment-manager/pdf";

/** The sample type's blank report form, for staff to check it. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sampleId: string }> },
) {
  const session = await requireAdmin();
  const { sampleId } = await params;
  try {
    return pdfResponse(await getReportForm(session.userId, sampleId), "report-form.pdf");
  } catch (error) {
    if (error instanceof ExperimentManagerError && error.status === 404) {
      return NextResponse.json({ error: "no report form" }, { status: 404 });
    }
    throw error;
  }
}
