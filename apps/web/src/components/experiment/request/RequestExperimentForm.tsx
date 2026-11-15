"use client";

import {
  Alert,
  Box,
  Checkbox,
  LoadingOverlay,
  Stack,
  Text,
} from "@mantine/core";
import { type FormAnswers, type FormDoc, FormRenderer } from "@repo/forms";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { requestExperimentAction } from "@/app/actions/experiment-request";
import { mergeClientForms } from "@/lib/experiment/intake";
import { myExperimentDetailPath } from "@/lib/experiment/routes";
import { formatAnswerIssue } from "@/lib/forms/answerIssues";

export interface RequestMethod {
  id: string;
  title: string;
  description?: string;
  clientForm: FormDoc;
}

interface RequestExperimentFormProps {
  sampleName: string;
  /** The method the client came for; ticked and always requested. */
  templateId: string;
  /** Every method of the sample type. */
  methods: RequestMethod[];
  canRequest: boolean;
  submitLabel?: string;
}

/**
 * One request = one physical sample: the client ticks the methods to run on it and
 * answers one intake form (questions shared by several methods are asked once).
 */
export function RequestExperimentForm({
  sampleName,
  templateId,
  methods,
  canRequest,
  submitLabel,
}: RequestExperimentFormProps) {
  const t = useTranslations("experiment.request.form");
  const tIssue = useTranslations("forms.validation");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>([templateId]);

  const intake = useMemo(
    () =>
      mergeClientForms(
        methods.filter((m) => chosen.includes(m.id)).map((m) => m.clientForm),
        sampleName,
      ),
    [methods, chosen, sampleName],
  );
  const isEmpty = intake.questions.length === 0;

  async function handleSubmit(answers: FormAnswers) {
    if (pending || !canRequest) return;
    setPending(true);
    setError(null);
    const result = await requestExperimentAction({
      templateId,
      templateIds: chosen,
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

      {methods.length > 1 && (
        <Checkbox.Group
          label={t("methodsLabel")}
          description={t("methodsDescription")}
          value={chosen}
          onChange={(ids) => setChosen(ids.includes(templateId) ? ids : [templateId, ...ids])}
        >
          <Stack gap="xs" mt="xs">
            {methods.map((m) => (
              <Checkbox
                key={m.id}
                value={m.id}
                label={m.title}
                description={m.description}
                disabled={m.id === templateId || pending || !canRequest}
              />
            ))}
          </Stack>
        </Checkbox.Group>
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
            doc={intake}
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
