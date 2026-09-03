import { Alert, Card, Container, Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { RequestExperimentForm } from "@/components/experiment/request/RequestExperimentForm";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { loadRequestTemplate } from "@/lib/experiment/data";
import { requestCatalogPath } from "@/lib/experiment/routes";

export const dynamic = "force-dynamic";

export default async function RequestExperimentPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ sampleId?: string }>;
}) {
  const { templateId } = await params;
  const { sampleId } = await searchParams;
  const t = await getTranslations("experiment.request");

  const loaded = await loadRequestTemplate(templateId, sampleId);
  if (!loaded) {
    notFound();
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Breadcrumbs
          items={[
            { label: t("catalog.breadcrumb"), href: requestCatalogPath() },
            { label: loaded.template.meta.title },
          ]}
        />

        <Stack gap={4}>
          <Title order={2}>{loaded.template.meta.title}</Title>
          {loaded.template.meta.description && (
            <Text c="dimmed">{loaded.template.meta.description}</Text>
          )}
        </Stack>

        {!loaded.template.valid && (
          <Alert color="orange" variant="light" title={t("form.outOfDateTitle")}>
            {t("form.outOfDateBody")}
          </Alert>
        )}

        {loaded.template.valid && !loaded.template.hasPdfTemplate && (
          <Alert color="orange" variant="light" title={t("form.noReportLayoutTitle")}>
            {t("form.noReportLayoutBody")}
          </Alert>
        )}

        <Card withBorder radius="md" padding="lg">
          <RequestExperimentForm
            sampleId={loaded.sampleId}
            templateId={templateId}
            clientForm={loaded.template.template.clientForm}
          />
        </Card>
      </Stack>
    </Container>
  );
}
