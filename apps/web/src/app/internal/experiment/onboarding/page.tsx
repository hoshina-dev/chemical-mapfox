import {
  Alert,
  Badge,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import Link from "next/link";

import { RegisterSampleButton } from "@/components/experiment/RegisterSampleButton";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import {
  listExperimentTemplates,
  listSamples,
} from "@/lib/experiment-manager/client";
import { sampleOnboardingPath } from "@/lib/experiment-manager/routes";

export const dynamic = "force-dynamic";

interface SampleCard {
  id: string;
  name: string;
  description?: string;
  /** Template count, or null if it couldn't be loaded for this sample. */
  templateCount: number | null;
}

async function loadSamples(): Promise<SampleCard[]> {
  const { samples } = await listSamples();
  return Promise.all(
    samples.map(async (sample) => {
      let templateCount: number | null = null;
      try {
        const { experiments } = await listExperimentTemplates(sample.id);
        templateCount = experiments.length;
      } catch {
        templateCount = null;
      }
      return {
        id: sample.id,
        name: sample.name,
        description: sample.description ?? undefined,
        templateCount,
      };
    }),
  );
}

export default async function OnboardingPage() {
  let samples: SampleCard[] | null = null;
  let loadError: string | null = null;
  try {
    samples = await loadSamples();
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load samples.";
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Breadcrumbs
          items={[{ label: "Onboarding" }]}
        />
        <Group justify="space-between" align="flex-end">
          <Stack gap={4}>
            <Title order={2}>Experiment onboarding</Title>
            <Text c="dimmed">
              Samples (specimen types) supported by the labs. Open one to manage
              its experiment templates, or register a new sample.
            </Text>
          </Stack>
          <RegisterSampleButton />
        </Group>

        {loadError && (
          <Alert
            color="red"
            variant="light"
            title="Could not reach Experiment Manager"
          >
            {loadError}
          </Alert>
        )}

        {samples && samples.length === 0 && !loadError && (
          <Text c="dimmed">No samples yet. Register your first one.</Text>
        )}

        {samples && samples.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {samples.map((sample) => (
              <Link
                key={sample.id}
                href={sampleOnboardingPath(sample.id)}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <Card withBorder radius="md" padding="lg" h="100%" className="bold-card">
                  <Stack gap="xs" h="100%">
                    <Group
                      justify="space-between"
                      align="flex-start"
                      wrap="nowrap"
                    >
                      <Text fw={600}>{sample.name}</Text>
                      <Badge variant="light" color="grape" radius="sm">
                        {sample.templateCount ?? "—"}{" "}
                        {sample.templateCount === 1 ? "template" : "templates"}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {sample.description ?? "No description"}
                    </Text>
                    <Text size="sm" c="green.8" fw={600} mt="auto">
                      Manage templates <span className="bold-card-arrow">→</span>
                    </Text>
                  </Stack>
                </Card>
              </Link>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
}
