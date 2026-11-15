import "server-only";

/** A PDF shown inline; the sandbox policy keeps the browser from running anything in it. */
export function pdfResponse(pdf: ArrayBuffer, filename: string, download = false): Response {
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
