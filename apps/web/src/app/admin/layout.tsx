import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth/dal";
import { listUserOrganizations } from "@/lib/auth/organizations";

export default async function AdminLayout({
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
      />
      {children}
    </>
  );
}
