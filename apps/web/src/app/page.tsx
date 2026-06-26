import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/AuthCard";
import { landingPathForRole } from "@/lib/auth/appRole";
import { getSession } from "@/lib/auth/dal";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect(landingPathForRole(session.role));
  }

  return <AuthCard />;
}
