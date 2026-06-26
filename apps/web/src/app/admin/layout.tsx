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
      <AdminNav name={session.name} role={session.role} />
      {children}
    </>
  );
}
