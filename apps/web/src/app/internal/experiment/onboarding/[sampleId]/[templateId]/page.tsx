import { Alert, Container } from "@mantine/core";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { BuilderApp } from "@/components/experiment/builder/BuilderApp";
import { toDraft } from "@/lib/builder";
import {
  ExperimentManagerError,
  getExperimentTemplate,
  getSample,
} from "@/lib/experiment-manager/client";
import { templateDetailToLoaded } from "@/lib/experiment-manager/mappers";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ sampleId: string; templateId: string }>;
}

export default async function EditTemplatePage({ params }: PageProps) {
  const { sampleId, templateId } = await params;
  const t = await getTranslations("builder.editPage");

  let loaded;
  let sampleName: string | undefined;
  try {
    const [detail, sample] = await Promise.all([
      getExperimentTemplate(sampleId, templateId),
      getSample(sampleId).catch(() => undefined),
    ]);
    loaded = templateDetailToLoaded(detail);
    sampleName = sample?.name;
  } catch (error) {
    if (error instanceof ExperimentManagerError && error.status === 404) {
      notFound();
    }
    return (
      <Container size="xl" py="xl">
        <Alert color="red" variant="light" title={t("loadErrorTitle")}>
          {error instanceof Error ? error.message : t("unknownError")}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      {!loaded.valid && (
        <Alert color="yellow" variant="light" title={t("legacyTitle")} mb="md">
          {t("legacyBody")}
        </Alert>
      )}
      <BuilderApp
        initial={toDraft(loaded.meta, loaded.template)}
        mode="edit"
        sampleId={sampleId}
        sampleName={sampleName}
        templateId={templateId}
        lineageId={loaded.lineageId}
      />
    </Container>
  );
}
