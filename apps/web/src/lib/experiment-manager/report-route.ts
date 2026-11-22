import "server-only";

import { getSession } from "@/lib/auth/dal";
import { levelForStatus, logHandledError } from "@/lib/log/handled";
import { httpStatus } from "@/lib/log/serialize";

import { getReport, getTicket } from "./client";
import { pdfResponse } from "./pdf";

type ReportAccess = "admin" | "ticket-owner";

async function canAccessReport(ticketId: string, access: ReportAccess): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  if (access === "admin") return session.role === "admin";
  try {
    return (await getTicket(undefined, ticketId)).requesterUserId === session.userId;
  } catch (error) {
    logHandledError(error, { op: "report.canAccess", contextId: ticketId, level: "warn" });
    return false;
  }
}

/**
 * The ticket's report (one per sample), built by experiment-manager from the sample
 * type's form, for staff or the requester. `?download=1` saves instead of showing.
 */
export async function reportPdfResponse(
  request: Request,
  ticketId: string,
  access: ReportAccess,
): Promise<Response> {
  if (!(await canAccessReport(ticketId, access))) {
    return new Response("Forbidden", { status: 403 });
  }
  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = `report-${ticketId.replace(/[^a-zA-Z0-9_-]/g, "")}.pdf`;
  try {
    return pdfResponse(await getReport(undefined, ticketId), filename, download);
  } catch (error) {
    // 404 = not published yet; anything else is an outage.
    const status = httpStatus(error);
    logHandledError(error, {
      op: "report.download",
      contextId: ticketId,
      expected: status === 404,
      level: status === 404 ? "info" : levelForStatus(status),
    });
    return new Response("The report is not ready yet.", { status: 404 });
  }
}
