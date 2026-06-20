"use client";

import { Alert, Box, LoadingOverlay, Stack, Text } from "@mantine/core";
import { type FormAnswers, type FormDoc, FormRenderer } from "@repo/forms";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { requestExperimentAction } from "@/app/actions/experiment-request";
import { myExperimentDetailPath } from "@/lib/experiment/routes";

interface RequestExperimentFormProps {
  sampleId: string;
  templateId: string;
  clientForm: FormDoc;
  submitLabel?: string;
}

export function RequestExperimentForm({
  sampleId,
  templateId,
  clientForm,
  submitLabel,
}: RequestExperimentFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = clientForm.questions.length === 0;

  async function handleSubmit(answers: FormAnswers) {
    setPending(true);
    setError(null);
    const result = await requestExperimentAction({
      sampleId,
      templateId,
      values: answers,
    });
    if (!result.success) {
      setError(result.error);
      setPending(false);
      return;
    }
    // Keep `pending` set so the form stays blocked while navigating away.
    router.push(myExperimentDetailPath(result.data.contextId));
  }

  return (
    <Stack gap="md">
      {error && (
        <Alert
          color="red"
          variant="light"
          title="Could not submit your request"
          style={{ whiteSpace: "pre-wrap" }}
        >
          {error}
        </Alert>
      )}

      {isEmpty && (
        <Text size="sm" c="dimmed">
          This experiment needs no intake details — submit to send your request
          to the lab.
        </Text>
      )}

      <Box pos="relative">
        <LoadingOverlay
          visible={pending}
          zIndex={1000}
          overlayProps={{ blur: 1 }}
        />
        <FormRenderer
          doc={clientForm}
          submitLabel={submitLabel ?? "Submit request"}
          onSubmit={handleSubmit}
        />
      </Box>
    </Stack>
  );
}
