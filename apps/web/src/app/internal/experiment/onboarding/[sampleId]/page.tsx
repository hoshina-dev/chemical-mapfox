import { Alert, Container, Group, Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";

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
import {
  newTemplatePath,
  onboardingPath,
} from "@/lib/experiment-manager/routes";

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
  const t = await getTranslations("staff.onboarding");

  let data: SampleTemplates | null = null;
  let loadError: string | null = null;
  try {
    data = await loadSample(sampleId);
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : t("sample.loadSampleFallback");
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Breadcrumbs
          items={[
            { label: t("breadcrumb"), href: onboardingPath() },
            { label: data?.sampleName ?? sampleId },
          ]}
        />
        <Group justify="space-between" align="flex-end">
          <Stack gap={4}>
            <Title order={2}>
              {data?.sampleName ?? t("sample.titleFallback")}
            </Title>
            <Text c="dimmed">
              {data?.sampleDescription ?? t("sample.defaultDescription")}
            </Text>
          </Stack>
          <LinkButton href={newTemplatePath(sampleId)} color="green">
            {t("sample.newTemplate")}
          </LinkButton>
        </Group>

        {loadError && (
          <Alert color="red" variant="light" title={t("loadErrorTitle")}>
            {loadError}
          </Alert>
        )}

        {data && data.templates.length === 0 && !loadError && (
          <Text c="dimmed">{t("sample.emptyTemplates")}</Text>
        )}

        {data && data.templates.length > 0 && (
          <SampleTemplatesTable templates={data.templates} />
        )}
      </Stack>
    </Container>
  );
}
