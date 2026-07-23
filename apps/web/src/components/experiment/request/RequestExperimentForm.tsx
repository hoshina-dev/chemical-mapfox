"use client";

import { Alert, Box, LoadingOverlay, Stack, Text } from "@mantine/core";
import { type FormAnswers, type FormDoc, FormRenderer } from "@repo/forms";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("experiment.request.form");
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
          title={t("errorTitle")}
          style={{ whiteSpace: "pre-wrap" }}
        >
          {error}
        </Alert>
      )}

      {isEmpty && (
        <Text size="sm" c="dimmed">
          {t("noIntake")}
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
          submitLabel={submitLabel ?? t("submit")}
          onSubmit={handleSubmit}
        />
      </Box>
    </Stack>
  );
}
