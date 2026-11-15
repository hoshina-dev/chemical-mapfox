import { reportPdfResponse } from "@/lib/sample-tracker/report-route";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contextId: string }> },
) {
  const { contextId } = await params;
  return reportPdfResponse(request, contextId, "ticket-owner");
}
