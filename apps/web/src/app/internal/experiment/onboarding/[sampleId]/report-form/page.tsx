import { Alert, Container, Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AsyncPanel } from "@/components/async/AsyncPanel";
import { PanelSkeleton } from "@/components/async/PanelSkeleton";
import { ReportFormEditor } from "@/components/experiment/report/ReportFormEditor";
import { ReportFormUpload } from "@/components/experiment/report/ReportFormUpload";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { requireAdmin } from "@/lib/auth/dal";
import {
  onboardingPath,
  reportFormPath,
  sampleOnboardingPath,
} from "@/lib/internal/routes";
import {
  experimentFields,
  experimentLabels,
  storedFields,
} from "@/lib/report/reportFields";
import {
  getSampleType,
  hasReportForm,
  listTemplates,
  SampleTrackerError,
} from "@/lib/sample-tracker/client";

export const dynamic = "force-dynamic";

/** Synchronous by design; the awaits live under `AsyncPanel` (see the other onboarding pages). */
export default function ReportFormPage(
  props: Parameters<typeof ReportFormContent>[0],
) {
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

async function ReportFormContent({
  params,
}: {
  params: Promise<{ sampleId: string }>;
}) {
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
  // The field map alone is not enough: reports are printed on the stored blank PDF.
  const [hasPdf, templates] = await Promise.all([
    hasReportForm(session.userId, sampleId),
    listTemplates(session.userId, sampleId),
  ]);
  const experiments = experimentFields(templates);
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
        {hasPdf ? (
          // Holds its own upload row: Replace PDF reloads the form in place.
          <ReportFormEditor
            sampleId={sampleId}
            pdfUrl={`${reportFormPath(sampleId)}/pdf`}
            initialFields={storedFields(sample.reportForm?.fields ?? [])}
            experiments={experiments}
            labels={experimentLabels(experiments)}
          />
        ) : (
          <>
            <ReportFormUpload sampleId={sampleId} hasPdf={false} />
            <Alert color="red" variant="light" title={t("noneTitle")}>
              {t("noneBody")}
            </Alert>
          </>
        )}
      </Stack>
    </Container>
  );
}
