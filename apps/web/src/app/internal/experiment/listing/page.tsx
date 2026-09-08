import { Alert } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { AdminExperimentsView } from "@/components/admin/AdminExperimentsView";
import { AsyncPanel } from "@/components/async/AsyncPanel";
import { PanelSkeleton } from "@/components/async/PanelSkeleton";
import {
  type EnrichedTicket,
  listExperimentsForStaff,
} from "@/lib/internal/experiments";

export const dynamic = "force-dynamic";

/**
 * The page function stays synchronous so Next can flush the shell before any
 * backend is touched — see `AsyncPanel`. The ticket fetch lives in the child
 * below, which is the only part that waits.
 */
export default function StaffExperimentsListingPage() {
  return (
    <AsyncPanel
      fallback={
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
          <PanelSkeleton lines={8} />
        </div>
      }
    >
      <StaffExperimentsList />
    </AsyncPanel>
  );
}

async function StaffExperimentsList() {
  const t = await getTranslations("staff.experiments");
  let tickets: EnrichedTicket[] | null = null;
  let degraded = false;
  let loadError: string | null = null;

  try {
    const result = await listExperimentsForStaff();
    tickets = result.tickets;
    degraded = result.enrichmentDegraded;
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : t("loadErrorFallback");
  }

  if (loadError) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <Alert color="red" variant="light" title={t("loadErrorTitle")}>
          {loadError}
        </Alert>
      </div>
    );
  }

  return (
    <>
      {degraded && (
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 0" }}>
          <Alert color="yellow" variant="light" title={t("degradedTitle")}>
            {t("degradedBody")}
          </Alert>
        </div>
      )}
      <AdminExperimentsView tickets={tickets ?? []} />
    </>
  );
}
