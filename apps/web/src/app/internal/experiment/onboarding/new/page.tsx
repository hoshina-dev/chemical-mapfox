import { Alert, Container } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { NewTemplateFlow } from "@/components/experiment/builder/NewTemplateFlow";
import { listSamples } from "@/lib/experiment-manager/client";
import { AsyncPanel } from "@/components/async/AsyncPanel";
import { PanelSkeleton } from "@/components/async/PanelSkeleton";

export const dynamic = "force-dynamic";


/**
 * Synchronous by design: Next withholds a route's entire HTML until the page
 * function returns, so awaiting here would keep the nav and chrome off screen
 * while a backend stalls. The awaits live in the content component, under
 * `AsyncPanel`.
 */
export default function NewTemplatePage(props: Parameters<typeof NewTemplatePageContent>[0]) {
  return (
    <AsyncPanel
      fallback={
        <Container size="xl" py="xl">
          <PanelSkeleton lines={8} />
        </Container>
      }
    >
      <NewTemplatePageContent {...props} />
    </AsyncPanel>
  );
}

async function NewTemplatePageContent({
  searchParams,
}: {
  searchParams: Promise<{ sampleId?: string }>;
}) {
  const { sampleId } = await searchParams;
  const t = await getTranslations("builder.newPage");
  let samples: { id: string; name: string }[] = [];
  let loadError: string | null = null;
  try {
    const res = await listSamples();
    samples = res.samples.map((s) => ({ id: s.id, name: s.name }));
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : t("loadSamplesFallback");
  }

  return (
    <Container size="xl" py="xl">
      {loadError ? (
        <Alert color="red" variant="light" title={t("loadErrorTitle")}>
          {loadError}
        </Alert>
      ) : (
        <NewTemplateFlow samples={samples} presetSampleId={sampleId} />
      )}
    </Container>
  );
}
