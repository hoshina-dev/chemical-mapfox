import { Alert, Container } from "@mantine/core";

import { NewTemplateFlow } from "@/components/experiment/builder/NewTemplateFlow";
import { listSamples } from "@/lib/experiment-manager/client";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  let samples: { id: string; name: string }[] = [];
  let loadError: string | null = null;
  try {
    const res = await listSamples();
    samples = res.samples.map((s) => ({ id: s.id, name: s.name }));
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load samples.";
  }

  return (
    <Container size="xl" py="xl">
      {loadError ? (
        <Alert color="red" variant="light" title="Could not reach Experiment Manager">
          {loadError}
        </Alert>
      ) : (
        <NewTemplateFlow samples={samples} />
      )}
    </Container>
  );
}
