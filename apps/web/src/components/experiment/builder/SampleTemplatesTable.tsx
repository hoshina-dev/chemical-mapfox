"use client";

import { CatalogueEditor } from "@/components/experiment/catalogue/CatalogueEditor";
import { templateBuilderPath } from "@/lib/experiment-manager/routes";
import type { TemplateSummary } from "@/lib/experiment-manager/mappers";

export function SampleTemplatesTable({
  templates,
  sampleId,
}: {
  templates: TemplateSummary[];
  sampleId: string;
}) {
  return (
    <CatalogueEditor
      variant="table"
      sampleId={sampleId}
      items={templates.map((template) => ({
        id: template.lineageId,
        name: template.title,
        description: template.description,
        href: templateBuilderPath(template),
        visible: template.isVisibleOnWeb,
        hasPdfTemplate: template.hasPdfTemplate,
      }))}
    />
  );
}
