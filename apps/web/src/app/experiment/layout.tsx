import { ClientNav } from "@/components/experiment/ClientNav";
import { requireClient } from "@/lib/auth/dal";

// The client-facing experiment flow is for clients only. Lab staff (app-role
// technician) use /internal/* instead and are redirected away by requireClient.
export default async function ExperimentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireClient();
  return (
    <>
      <ClientNav />
      {children}
    </>
  );
}
