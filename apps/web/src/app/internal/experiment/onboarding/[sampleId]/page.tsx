import { Alert, Container, Group, Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { SampleTemplatesTable } from "@/components/experiment/builder/SampleTemplatesTable";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { LinkButton } from "@/components/links";
import { requireAdmin } from "@/lib/auth/dal";
import type { TemplateSummary } from "@/lib/experiment/templates";
import {
  newTemplatePath,
  onboardingPath,
  reportFormPath,
} from "@/lib/internal/routes";
import { getSampleType, hasReportForm, listTemplates } from "@/lib/sample-tracker/client";
import { toTemplateSummary } from "@/lib/sample-tracker/mappers";
import { AsyncPanel } from "@/components/async/AsyncPanel";
import { PanelSkeleton } from "@/components/async/PanelSkeleton";

export const dynamic = "force-dynamic";

interface SampleTemplates {
  sampleName: string;
  sampleDescription?: string;
  /** Whether the blank report form (PDF) is stored; without it no report can be published. */
  hasReportForm: boolean;
  templates: TemplateSummary[];
}

async function loadSample(actor: string, sampleId: string): Promise<SampleTemplates> {
  const [sample, templates, reportForm] = await Promise.all([
    getSampleType(actor, sampleId),
    listTemplates(actor, sampleId),
    hasReportForm(actor, sampleId),
  ]);
  return {
    sampleName: sample.name,
    sampleDescription: sample.description ?? undefined,
    hasReportForm: reportForm,
    templates: templates.map(toTemplateSummary),
  };
}

/**
 * Synchronous by design: Next withholds a route's entire HTML until the page
 * function returns, so awaiting here would keep the nav and chrome off screen
 * while a backend stalls. The awaits live in the content component, under
 * `AsyncPanel`.
 */
export default function SampleOnboardingPage(
  props: Parameters<typeof SampleOnboardingPageContent>[0],
) {
  return (
    <AsyncPanel
      fallback={
        <Container size="xl" py="xl">
          <PanelSkeleton lines={8} />
        </Container>
      }
    >
      <SampleOnboardingPageContent {...props} />
    </AsyncPanel>
  );
}

async function SampleOnboardingPageContent({
  params,
}: {
  params: Promise<{ sampleId: string }>;
}) {
  const session = await requireAdmin();
  const { sampleId } = await params;
  const t = await getTranslations("staff.onboarding");

  let data: SampleTemplates | null = null;
  let loadError: string | null = null;
  try {
    data = await loadSample(session.userId, sampleId);
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
            <Group gap="sm" align="baseline">
              <Title order={2}>
                {data?.sampleName ?? t("sample.titleFallback")}
              </Title>
              {data && !data.hasReportForm && (
                <Text c="red" size="sm" fw={500}>
                  {t("sample.noReportTemplate")}
                </Text>
              )}
            </Group>
            <Text c="dimmed">
              {data?.sampleDescription ?? t("sample.defaultDescription")}
            </Text>
          </Stack>
          <Group gap="sm">
            <LinkButton href={reportFormPath(sampleId)} variant="default">
              {t("sample.reportForm")}
            </LinkButton>
            <LinkButton href={newTemplatePath(sampleId)} color="green">
              {t("sample.newTemplate")}
            </LinkButton>
          </Group>
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
          <SampleTemplatesTable
            templates={data.templates}
            sampleId={sampleId}
          />
        )}
      </Stack>
    </Container>
  );
}
