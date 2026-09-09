import { Landing } from "@/components/landing/Landing";
import { landingPathForRole } from "@/lib/auth/appRole";
import { getSession } from "@/lib/auth/dal";
import { getLabOffer } from "@/lib/landing/offer";
import { AsyncPanel } from "@/components/async/AsyncPanel";
import { PanelSkeleton } from "@/components/async/PanelSkeleton";

export const dynamic = "force-dynamic";


/**
 * Synchronous by design: Next withholds a route's entire HTML until the page
 * function returns, so awaiting here would keep the shell off screen while a
 * backend stalls. The awaits live in the content component, under `AsyncPanel`.
 */
export default function HomePage() {
  return (
    <AsyncPanel
      fallback={
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
          <PanelSkeleton lines={8} />
        </div>
      }
    >
      <HomePageContent />
    </AsyncPanel>
  );
}

async function HomePageContent() {
  const session = await getSession();
  const workspaceHref = session ? landingPathForRole(session.role) : null;
  const offer = await getLabOffer();

  return <Landing workspaceHref={workspaceHref} offer={offer} />;
}
