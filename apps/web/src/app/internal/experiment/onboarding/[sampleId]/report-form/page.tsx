import { Alert, Container, Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AsyncPanel } from "@/components/async/AsyncPanel";
import { PanelSkeleton } from "@/components/async/PanelSkeleton";
import { ReportFormUpload } from "@/components/experiment/report/ReportFormUpload";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { requireAdmin } from "@/lib/auth/dal";
import {
  onboardingPath,
  reportFormPath,
  sampleOnboardingPath,
} from "@/lib/experiment-manager/routes";
import { getSampleType, SampleTrackerError } from "@/lib/sample-tracker/client";

export const dynamic = "force-dynamic";

/** Synchronous by design; the awaits live under `AsyncPanel` (see the other onboarding pages). */
export default function ReportFormPage(props: Parameters<typeof ReportFormContent>[0]) {
  return (
    <AsyncPanel
      fallback={
        <Container size="xl" py="xl">
          <PanelSkeleton lines={8} />
        </Container>
      }
    >
      <ReportFormContent {...props} />
    </AsyncPanel>
  );
}

async function ReportFormContent({ params }: { params: Promise<{ sampleId: string }> }) {
  const session = await requireAdmin();
  const { sampleId } = await params;
  const t = await getTranslations("staff.reportForm");
  const tOnboarding = await getTranslations("staff.onboarding");
  let sample;
  try {
    sample = await getSampleType(session.userId, sampleId);
  } catch (error) {
    if (error instanceof SampleTrackerError && error.status === 404) notFound();
    throw error;
  }
  const fields = sample.reportForm?.fields ?? [];
  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Breadcrumbs
          items={[
            { label: tOnboarding("breadcrumb"), href: onboardingPath() },
            { label: sample.name, href: sampleOnboardingPath(sampleId) },
            { label: t("title") },
          ]}
        />
        <Stack gap={4}>
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed">{t("subtitle")}</Text>
        </Stack>
        {sample.reportForm ? (
          <Alert color="green" variant="light" title={t("currentTitle")}>
            <Text size="sm">{t("currentBody", { count: fields.length })}</Text>
            <Text size="sm" component="a" href={`${reportFormPath(sampleId)}/pdf`} target="_blank" c="blue">
              {t("download")}
            </Text>
          </Alert>
        ) : (
          <Alert color="gray" variant="light" title={t("noneTitle")}>
            {t("noneBody")}
          </Alert>
        )}
        <ReportFormUpload
          sampleId={sampleId}
          initialFields={JSON.stringify({ fields }, null, 2)}
        />
      </Stack>
    </Container>
  );
}
