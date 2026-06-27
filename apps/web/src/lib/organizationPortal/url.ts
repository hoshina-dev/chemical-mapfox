export function organizationPageUrl(baseUrl: string, orgId: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/organization/${encodeURIComponent(orgId)}`;
}
