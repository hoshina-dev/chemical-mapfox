import { getSession } from "@/lib/auth/dal";
import { getReportDownloadUrl } from "@/lib/experiment-manager/client";

export const dynamic = "force-dynamic";

function reportFilename(contextId: string): string {
  return `experiment-${contextId.replace(/[^a-zA-Z0-9_-]/g, "")}-report.pdf`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contextId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (session.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const { contextId } = await params;
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
