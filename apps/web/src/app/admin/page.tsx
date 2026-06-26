import { Alert, Container } from "@mantine/core";

import { AdminExperimentsView } from "@/components/admin/AdminExperimentsView";
import {
  type EnrichedTicket,
  listExperimentsForStaff,
} from "@/lib/internal/experiments";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let tickets: EnrichedTicket[] | null = null;
  let degraded = false;
  let loadError: string | null = null;

  try {
    const result = await listExperimentsForStaff();
    tickets = result.tickets;
    degraded = result.enrichmentDegraded;
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load experiments.";
  }

  if (loadError) {
    return (
      <Container size="lg" py="xl">
        <Alert color="red" variant="light" title="Could not reach Ticketing Service">
          {loadError}
        </Alert>
      </Container>
    );
  }

  return (
    <>
      {degraded && (
        <Container size="lg" pt="md">
          <Alert color="yellow" variant="light" title="Some requester details unavailable">
            Requester details could not be loaded from the user service. The list below is
            complete; some requester cells may show raw user IDs.
          </Alert>
        </Container>
      )}
      <AdminExperimentsView tickets={tickets ?? []} />
    </>
  );
}
