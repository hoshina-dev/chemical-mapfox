import { Alert, Container, Group, Stack, Text, Title } from "@mantine/core";

import { SampleTemplatesTable } from "@/components/experiment/builder/SampleTemplatesTable";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { LinkButton } from "@/components/links";
import {
  getSample,
  listExperimentTemplates,
} from "@/lib/experiment-manager/client";
import {
  type TemplateSummary,
  toTemplateSummary,
} from "@/lib/experiment-manager/mappers";
import { newTemplatePath, onboardingPath } from "@/lib/experiment-manager/routes";

export const dynamic = "force-dynamic";

interface SampleTemplates {
  sampleName: string;
  sampleDescription?: string;
  templates: TemplateSummary[];
}

async function loadSample(sampleId: string): Promise<SampleTemplates> {
  const [sample, { experiments }] = await Promise.all([
    getSample(sampleId),
    listExperimentTemplates(sampleId),
  ]);
  return {
    sampleName: sample.name,
    sampleDescription: sample.description ?? undefined,
    templates: experiments.map((row) => toTemplateSummary(sampleId, row)),
  };
}

export default async function SampleOnboardingPage({
  params,
}: {
  params: Promise<{ sampleId: string }>;
}) {
  const { sampleId } = await params;

  let data: SampleTemplates | null = null;
  let loadError: string | null = null;
  try {
    data = await loadSample(sampleId);
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load sample.";
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Breadcrumbs
          items={[
            { label: "Internal", href: "/dashboard" },
            { label: "Onboarding", href: onboardingPath() },
            { label: data?.sampleName ?? sampleId },
          ]}
        />
        <Group justify="space-between" align="flex-end">
          <Stack gap={4}>
            <Title order={2}>{data?.sampleName ?? "Sample"}</Title>
            <Text c="dimmed">
              {data?.sampleDescription ??
                "Experiment templates for this sample."}
            </Text>
          </Stack>
          <LinkButton href={newTemplatePath(sampleId)} color="green">
            New template
          </LinkButton>
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

        {data && data.templates.length === 0 && !loadError && (
          <Text c="dimmed">
            No templates yet for this sample. Create the first one.
          </Text>
        )}

        {data && data.templates.length > 0 && (
          <SampleTemplatesTable templates={data.templates} />
        )}
      </Stack>
    </Container>
  );
}
