import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/dal";
import { previewReportForm, ExperimentManagerError } from "@/lib/experiment-manager/client";
import { pdfResponse } from "@/lib/experiment-manager/pdf";

export const dynamic = "force-dynamic";

/** The sample type's report drawn with sample values: the report form editor's preview. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sampleId: string }> },
) {
  const session = await requireAdmin();
  const { sampleId } = await params;
  try {
    return pdfResponse(await previewReportForm(session.userId, sampleId), "report-preview.pdf");
  } catch (error) {
    if (error instanceof ExperimentManagerError && error.status === 404) {
      return NextResponse.json({ error: "no report form" }, { status: 404 });
    }
    throw error;
  }
}
