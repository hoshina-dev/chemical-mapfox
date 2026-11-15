import { Alert, Card, Container, Stack, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { RequestExperimentForm } from "@/components/experiment/request/RequestExperimentForm";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { loadRequestTemplate } from "@/lib/experiment/data";
import { requestCatalogPath } from "@/lib/experiment/routes";
import { AsyncPanel } from "@/components/async/AsyncPanel";
import { PanelSkeleton } from "@/components/async/PanelSkeleton";

export const dynamic = "force-dynamic";


/**
 * Synchronous by design: Next withholds a route's entire HTML until the page
 * function returns, so awaiting here would keep the nav and chrome off screen
 * while a backend stalls. The awaits live in the content component, under
 * `AsyncPanel`.
 */
export default function RequestExperimentPage(props: Parameters<typeof RequestExperimentPageContent>[0]) {
  return (
    <AsyncPanel
      fallback={
        <Container size="md" py="xl">
          <PanelSkeleton lines={8} />
        </Container>
      }
    >
      <RequestExperimentPageContent {...props} />
    </AsyncPanel>
  );
}

async function RequestExperimentPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  /** `methods`: other methods of the sample type ticked in the catalogue. */
  searchParams: Promise<{ methods?: string }>;
}) {
  const { templateId } = await params;
  const { methods } = await searchParams;
  const t = await getTranslations("experiment.request");

  const loaded = await loadRequestTemplate(templateId);
  if (!loaded) {
    notFound();
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Breadcrumbs
          items={[
            { label: t("catalog.breadcrumb"), href: requestCatalogPath() },
            { label: loaded.sampleName },
          ]}
        />

        <Title order={2}>{loaded.sampleName}</Title>

        {!loaded.template.valid && (
          <Alert color="orange" variant="light" title={t("form.outOfDateTitle")}>
            {t("form.outOfDateBody")}
          </Alert>
        )}

        <Card withBorder radius="md" padding="lg">
          <RequestExperimentForm
            templateId={templateId}
            initialMethods={(methods ?? "").split(",")}
            methods={loaded.methods
              .filter((m) => m.valid)
              .map((m) => ({
                id: m.id,
                title: m.meta.title,
                description: m.meta.description,
                clientForm: m.template.clientForm,
              }))}
            canRequest={loaded.template.valid}
          />
        </Card>
      </Stack>
    </Container>
  );
}
