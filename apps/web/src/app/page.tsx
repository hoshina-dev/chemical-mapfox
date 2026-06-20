import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/AuthCard";
import { getSession } from "@/lib/auth/dal";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  return <AuthCard />;
}
