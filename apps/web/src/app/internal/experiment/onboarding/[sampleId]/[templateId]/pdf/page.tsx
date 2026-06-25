import { Alert, Container } from "@mantine/core";
import { notFound } from "next/navigation";

import { listTemplateExperimentsAction } from "@/app/actions/pdf";
import { PdfEditor } from "@/components/experiment/pdf-editor/PdfEditor";
import type {
  PdfComp,
  VariableGroup,
} from "@/components/experiment/pdf-editor/types";
import { requireAdmin } from "@/lib/auth/dal";
import {
  ExperimentManagerError,
  getExperimentTemplate,
  getPdfTemplate,
} from "@/lib/experiment-manager/client";

export const dynamic = "force-dynamic";

interface PdfEditorPageProps {
  params: Promise<{ sampleId: string; templateId: string }>;
}

type SnapshotQuestion = {
  id: string;
  type?: string;
  label?: string;
  config?: {
    default?: unknown;
    questions?: Array<{ id: string; label?: string }>;
  };
};

function expandSourceVars(
  questions: SnapshotQuestion[],
  tag: "client" | "lab",
): Array<{ id: string; label: string }> {
  const vars: Array<{ id: string; label: string }> = [];
  for (const q of questions) {
    if (q.type === "repeatable-group") {
      for (const child of q.config?.questions ?? []) {
        vars.push({ id: child.id, label: `${child.label ?? child.id} (lab)` });
      }
    } else {
      vars.push({ id: q.id, label: `${q.label ?? q.id} (${tag})` });
    }
  }
  return vars;
}

export default async function PdfEditorPage({ params }: PdfEditorPageProps) {
  await requireAdmin();
  const { sampleId, templateId } = await params;

  let template;
  try {
    template = await getExperimentTemplate(sampleId, templateId);
  } catch (err) {
    if (err instanceof ExperimentManagerError && err.status === 404) notFound();
    return (
      <Container size="xl" py="xl">
        <Alert color="red" variant="light" title="PDF editor unavailable">
          Could not load the experiment template.
        </Alert>
      </Container>
    );
  }

  // PDF components — a 404 just means no layout has been saved yet.
  let initialComponents: PdfComp[] = [];
  try {
    const pdf = await getPdfTemplate(sampleId, templateId);
    initialComponents = (pdf.components ?? []) as PdfComp[];
  } catch (err) {
    if (!(err instanceof ExperimentManagerError && err.status === 404)) {
      return (
        <Container size="xl" py="xl">
          <Alert color="red" variant="light" title="PDF editor unavailable">
            Could not load the PDF layout.
          </Alert>
        </Container>
      );
    }
  }

  // Experiments created from this lineage, for the "from experiment" preview.
  const experimentsResult = await listTemplateExperimentsAction(
    template.lineage_id,
  );
  const experiments = experimentsResult.success ? experimentsResult.data : [];

  // Variable groups offered in the editor's left rail.
  const sourceVars = [
    ...expandSourceVars(
      (template.clientForm?.questions ?? []) as SnapshotQuestion[],
      "client",
    ),
    ...expandSourceVars(
      (template.labForm?.questions ?? []) as SnapshotQuestion[],
      "lab",
    ),
  ];
  const calcVars = Object.keys(template.calculations ?? {}).map((key) => ({
    id: key,
    label: key,
  }));
  const variableGroups: VariableGroup[] = [
    ...(sourceVars.length > 0
      ? [{ name: "Source", variables: sourceVars }]
      : []),
    ...(calcVars.length > 0
      ? [{ name: "Calculated", variables: calcVars }]
      : []),
  ];

  // Default values for the "use defaults" preview mode.
  const questionDefaults: Record<string, unknown> = {};
  for (const q of [
    ...(template.clientForm?.questions ?? []),
    ...(template.labForm?.questions ?? []),
  ] as SnapshotQuestion[]) {
    if (q.type === "repeatable-group") continue;
    const def = q.config?.default;
    if (def !== undefined) questionDefaults[q.id] = def;
  }

  return (
    <PdfEditor
      sampleId={sampleId}
      templateId={templateId}
      lineageId={template.lineage_id}
      initialComponents={initialComponents}
      variableGroups={variableGroups}
      questionDefaults={questionDefaults}
      experiments={experiments}
    />
  );
}
