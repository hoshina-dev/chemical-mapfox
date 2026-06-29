import { Landing } from "@/components/landing/Landing";
import { landingPathForRole } from "@/lib/auth/appRole";
import { getSession } from "@/lib/auth/dal";
import { getLabOffer } from "@/lib/landing/offer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  const workspaceHref = session ? landingPathForRole(session.role) : null;
  const offer = await getLabOffer();

  return <Landing workspaceHref={workspaceHref} offer={offer} />;
}
