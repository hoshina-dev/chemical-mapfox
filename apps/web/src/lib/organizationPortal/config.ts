import "server-only";

const DEFAULT_ORGANIZATION_PORTAL_URL = "https://your-org-portal.example.com";

export function getOrganizationPortalUrl(): string {
  return (
    process.env.ORGANIZATION_PORTAL_URL?.replace(/\/$/, "") ??
    DEFAULT_ORGANIZATION_PORTAL_URL
  );
}
