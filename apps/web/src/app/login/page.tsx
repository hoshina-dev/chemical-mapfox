import { redirect } from "next/navigation";

import { AuthCard, type AuthTab } from "@/components/auth/AuthCard";
import { landingPathForRole } from "@/lib/auth/appRole";
import { getSession } from "@/lib/auth/dal";
import { safeReturnTo } from "@/lib/auth/returnTo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; next?: string }>;
}) {
  const { tab, next } = await searchParams;
  const returnTo = safeReturnTo(next);

  const session = await getSession();
  if (session) {
    redirect(returnTo ?? landingPathForRole(session.role));
  }

  const defaultTab: AuthTab = tab === "register" ? "register" : "login";

  return <AuthCard defaultTab={defaultTab} returnTo={returnTo} />;
}
