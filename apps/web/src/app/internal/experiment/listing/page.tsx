import { Alert, Container, Stack, Text, Title } from "@mantine/core";

import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { ExperimentListingTable } from "@/components/internal/ExperimentListingTable";
import {
  type EnrichedTicket,
  listExperimentsForStaff,
} from "@/lib/internal/experiments";

export const dynamic = "force-dynamic";

export default async function ExperimentListingPage() {
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

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Breadcrumbs
          items={[{ label: "Internal", href: "/dashboard" }, { label: "Experiments" }]}
        />
        <Stack gap={4}>
          <Title order={2}>Experiments</Title>
          <Text c="dimmed">
            Every experiment ticket from the ticketing service. Search, sort by
            any column, and open one to start working.
          </Text>
        </Stack>

        {loadError && (
          <Alert color="red" variant="light" title="Could not reach Ticketing Service">
            {loadError}
          </Alert>
        )}

        {degraded && !loadError && (
          <Alert color="yellow" variant="light" title="Some requester details unavailable">
            Requester details could not be loaded from the user service. The
            list below is complete; some requester cells may show raw user IDs.
          </Alert>
        )}

        {tickets && <ExperimentListingTable tickets={tickets} />}
      </Stack>
    </Container>
  );
}
