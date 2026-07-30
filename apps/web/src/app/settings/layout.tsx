import { AdminNav } from "@/components/admin/AdminNav";
import { ClientNav } from "@/components/experiment/ClientNav";
import { requireSession } from "@/lib/auth/dal";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  const navProps = {
    name: session.name,
    email: session.email,
    avatarUrl: session.avatarUrl,
    role: session.role,
  };

  return (
    <>
      {session.role === "admin" ? (
        <AdminNav {...navProps} />
      ) : (
        <ClientNav {...navProps} />
      )}
      {children}
    </>
  );
}
