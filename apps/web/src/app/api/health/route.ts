export function GET() {
  return Response.json({ status: "ok", uptimeMs: Math.round(process.uptime() * 1000) });
}