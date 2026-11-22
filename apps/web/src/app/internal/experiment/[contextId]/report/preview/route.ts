import { requireAdmin } from "@/lib/auth/dal";
import { previewReport, ExperimentManagerError } from "@/lib/experiment-manager/client";
import { pdfResponse } from "@/lib/experiment-manager/pdf";

export const dynamic = "force-dynamic";

/**
 * What publishing the ticket's report would issue now, for staff to check: nothing is
 * recorded and nobody is emailed. Why it cannot be built (not completed, a missing
 * result) is shown as text.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ contextId: string }> },
) {
  const session = await requireAdmin();
  const { contextId } = await params;
  try {
    return pdfResponse(await previewReport(session.userId, contextId), "report-preview.pdf");
  } catch (error) {
    if (error instanceof ExperimentManagerError && error.status < 500) {
      return new Response(error.detail ?? "The report cannot be previewed.", {
        status: error.status,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    throw error;
  }
}
