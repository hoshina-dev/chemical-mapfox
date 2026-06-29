import { redirect } from "next/navigation";

import { AuthCard, type AuthTab } from "@/components/auth/AuthCard";
import { landingPathForRole } from "@/lib/auth/appRole";
import { getSession } from "@/lib/auth/dal";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect(landingPathForRole(session.role));
  }

  const { tab } = await searchParams;
  const defaultTab: AuthTab = tab === "register" ? "register" : "login";

  return <AuthCard defaultTab={defaultTab} />;
}
