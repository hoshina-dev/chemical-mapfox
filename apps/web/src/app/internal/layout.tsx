import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth/dal";
import { listUserOrganizations } from "@/lib/auth/organizations";
import { getOrganizationPortalUrl } from "@/lib/organizationPortal/config";

// Server-side authorization backstop for everything under /internal/*.
// The middleware (proxy.ts) is the first gate; this ensures the admin check
// also runs in the render path, where it cannot be bypassed. Renders the same
// nav as /admin/users so the whole admin-facing area shares one chrome.
export default async function InternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAdmin();
  const organizations = await listUserOrganizations(session.userId);
  return (
    <>
      <AdminNav
        name={session.name}
        email={session.email}
        avatarUrl={session.avatarUrl}
        role={session.role}
        organizations={organizations}
        organizationPortalUrl={getOrganizationPortalUrl()}
      />
      {children}
    </>
  );
}
