import { Alert, Container, Stack, Text, Title } from "@mantine/core";

import { RequestCatalog } from "@/components/experiment/request/RequestCatalog";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { type CatalogGroup, listRequestCatalog } from "@/lib/experiment/data";

export const dynamic = "force-dynamic";

export default async function RequestCatalogPage() {
  let groups: CatalogGroup[] | null = null;
  let loadError: string | null = null;

  try {
    groups = await listRequestCatalog();
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load the catalogue.";
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Request an experiment" },
          ]}
        />
        <Stack gap={4}>
          <Title order={2}>Request an experiment</Title>
          <Text c="dimmed">
            Browse the specimens our labs support and start a request from a
            template.
          </Text>
        </Stack>

        {loadError && (
          <Alert color="red" variant="light" title="Could not load the catalogue">
            {loadError}
          </Alert>
        )}

        {groups && <RequestCatalog groups={groups} />}
      </Stack>
    </Container>
  );
}
