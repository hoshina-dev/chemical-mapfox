import { reportPdfResponse } from "@/lib/experiment-manager/report-route";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contextId: string }> },
) {
  const { contextId } = await params;
  return reportPdfResponse(request, contextId, "ticket-owner");
}
