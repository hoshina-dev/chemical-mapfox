"use client";

import { CatalogueEditor } from "@/components/experiment/catalogue/CatalogueEditor";
import { templateBuilderPath } from "@/lib/internal/routes";
import type { TemplateSummary } from "@/lib/experiment/templates";

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
