import { ClientNav } from "@/components/experiment/ClientNav";
import { requireClient } from "@/lib/auth/dal";
import { listUserOrganizations } from "@/lib/auth/organizations";

// The client-facing experiment flow is for clients only. Lab staff (app-role
// technician) use /internal/* instead and are redirected away by requireClient.
export default async function ExperimentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireClient();
  const organizations = await listUserOrganizations(session.userId);
  return (
    <>
      <ClientNav
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
