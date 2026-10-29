import { Alert, Container, Group, Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { CatalogueEditor } from "@/components/experiment/catalogue/CatalogueEditor";
import { RegisterSampleButton } from "@/components/experiment/RegisterSampleButton";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { requireAdmin } from "@/lib/auth/dal";
import {
  listExperimentTemplates,
  listSamples,
} from "@/lib/experiment-manager/client";
import { sampleOnboardingPath } from "@/lib/experiment-manager/routes";
import { AsyncPanel } from "@/components/async/AsyncPanel";
import { PanelSkeleton } from "@/components/async/PanelSkeleton";

export const dynamic = "force-dynamic";

interface SampleCard {
  id: string;
  name: string;
  description?: string;
  /** Template count, or null if it couldn't be loaded for this sample. */
  templateCount: number | null;
  isVisibleOnWeb: boolean;
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
        isVisibleOnWeb: sample.is_visible_on_web,
        name: sample.name,
        description: sample.description ?? undefined,
        templateCount,
      };
    }),
  );
}

/**
 * Synchronous by design: Next withholds a route's entire HTML until the page
 * function returns, so awaiting here would keep the nav and chrome off screen
 * while a backend stalls. The awaits live in the content component, under
 * `AsyncPanel`.
 */
export default function OnboardingPage() {
  return (
    <AsyncPanel
      fallback={
        <Container size="xl" py="xl">
          <PanelSkeleton lines={8} />
        </Container>
      }
    >
      <OnboardingPageContent />
    </AsyncPanel>
  );
}

async function OnboardingPageContent() {
  await requireAdmin();
  const t = await getTranslations("staff.onboarding");

  let samples: SampleCard[] | null = null;
  let loadError: string | null = null;
  try {
    samples = await loadSamples();
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : t("loadSamplesFallback");
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Breadcrumbs items={[{ label: t("breadcrumb") }]} />
        <Group justify="space-between" align="flex-end">
          <Stack gap={4}>
            <Title order={2}>{t("title")}</Title>
            <Text c="dimmed">{t("subtitle")}</Text>
          </Stack>
          <RegisterSampleButton />
        </Group>

        {loadError && (
          <Alert color="red" variant="light" title={t("loadErrorTitle")}>
            {loadError}
          </Alert>
        )}

        {samples && samples.length === 0 && !loadError && (
          <Text c="dimmed">{t("emptyMessage")}</Text>
        )}

        {samples && samples.length > 0 && (
          <CatalogueEditor
            items={samples.map((sample) => ({
              id: sample.id,
              name: sample.name,
              description: sample.description,
              visible: sample.isVisibleOnWeb,
              count: sample.templateCount,
              href: sampleOnboardingPath(sample.id),
            }))}
          />
        )}
      </Stack>
    </Container>
  );
}
