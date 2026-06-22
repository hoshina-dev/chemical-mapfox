import "server-only";

import { getSession } from "@/lib/auth/dal";
import { getReportDownloadUrl } from "@/lib/experiment-manager/client";
import { ticketsApi } from "@/lib/ticketing/client";

type ReportAccess = "admin" | "ticket-owner";

function reportFilename(contextId: string): string {
  return `experiment-${contextId.replace(/[^a-zA-Z0-9_-]/g, "")}-report.pdf`;
}

async function canAccessReport(
  contextId: string,
  access: ReportAccess,
): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  if (access === "admin") return session.role === "admin";

  try {
    const ticket = await ticketsApi.apiV1TicketsIdGet(contextId);
    return ticket.userId === session.userId;
  } catch {
    return false;
  }
}

export async function reportPdfResponse(
  request: Request,
  contextId: string,
  access: ReportAccess,
) {
  if (!(await canAccessReport(contextId, access))) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const disposition = searchParams.get("download") === "1" ? "attachment" : "inline";

  try {
    const { url } = await getReportDownloadUrl(contextId);
    const upstream = await fetch(url, { cache: "no-store" });

    if (!upstream.ok) {
      return new Response("Could not load report PDF.", {
        status: upstream.status,
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `${disposition}; filename="${reportFilename(contextId)}"`,
        "Content-Type": upstream.headers.get("content-type") ?? "application/pdf",
      },
    });
  } catch {
    return new Response("The report is not ready yet.", { status: 404 });
  }
}
