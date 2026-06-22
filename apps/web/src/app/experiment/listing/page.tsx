import { Alert, Container, Group, Stack, Text, Title } from "@mantine/core";

import { MyExperimentsBoard } from "@/components/experiment/MyExperimentsBoard";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { LinkButton } from "@/components/links";
import { requireSession } from "@/lib/auth/dal";
import { listMyExperiments, type MyExperiment } from "@/lib/experiment/data";
import { requestCatalogPath } from "@/lib/experiment/routes";

export const dynamic = "force-dynamic";

export default async function MyExperimentsPage() {
  const session = await requireSession();

  let experiments: MyExperiment[] | null = null;
  let loadError: string | null = null;

  try {
    experiments = await listMyExperiments(session.userId);
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load experiments.";
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "My experiments" },
          ]}
        />

        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={4}>
            <Title order={2}>My experiments</Title>
            <Text c="dimmed">
              Every experiment you&apos;ve requested, grouped by where it is in
              the lab&apos;s workflow. Open one to see its details.
            </Text>
          </Stack>
          <LinkButton href={requestCatalogPath()}>
            Request an experiment
          </LinkButton>
        </Group>

        {loadError && (
          <Alert color="red" variant="light" title="Could not load your experiments">
            {loadError}
          </Alert>
        )}

        {experiments && <MyExperimentsBoard experiments={experiments} />}
      </Stack>
    </Container>
  );
}
