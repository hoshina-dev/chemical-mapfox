import { Alert, Container } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { NewTemplateFlow } from "@/components/experiment/builder/NewTemplateFlow";
import { listSamples } from "@/lib/experiment-manager/client";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage({
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
