"use client";

import { Alert, Box, LoadingOverlay, Stack, Text } from "@mantine/core";
import { type FormAnswers, type FormDoc, FormRenderer } from "@repo/forms";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { requestExperimentAction } from "@/app/actions/experiment-request";
import { formatAnswerIssue } from "@/lib/forms/answerIssues";
import { myExperimentDetailPath } from "@/lib/experiment/routes";

interface RequestExperimentFormProps {
  sampleId: string;
  templateId: string;
  clientForm: FormDoc;
  canRequest: boolean;
  submitLabel?: string;
}

export function RequestExperimentForm({
  sampleId,
  templateId,
  clientForm,
  canRequest,
  submitLabel,
}: RequestExperimentFormProps) {
  const t = useTranslations("experiment.request.form");
  const tIssue = useTranslations("forms.validation");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = clientForm.questions.length === 0;

  async function handleSubmit(answers: FormAnswers) {
    if (pending || !canRequest) return;
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
        <fieldset
          disabled={pending || !canRequest}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <FormRenderer
            doc={clientForm}
            submitLabel={submitLabel ?? t("submit")}
            missingRequiredTitle={t("missingRequired")}
            invalidTitle={tIssue("invalidTitle")}
            formatIssue={(issue) => formatAnswerIssue(tIssue, issue)}
            onSubmit={handleSubmit}
          />
        </fieldset>
      </Box>
    </Stack>
  );
}
