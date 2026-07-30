import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth/dal";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAdmin();
  return (
    <>
      <AdminNav
        name={session.name}
        email={session.email}
        avatarUrl={session.avatarUrl}
        role={session.role}
      />
      {children}
    </>
  );
}
