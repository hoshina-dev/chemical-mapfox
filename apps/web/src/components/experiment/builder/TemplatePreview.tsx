"use client";

import type { ExperimentTemplate, FormAnswers } from "@repo/forms";
import { FormRenderer } from "@repo/forms";
import { Code, Divider, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CalculationTester } from "./CalculationTester";

interface TemplatePreviewProps {
  template: ExperimentTemplate;
}

/**
 * Interactive preview of both forms in a template — fields are editable so the
 * author can try dropdowns, switches, sliders, etc. "Capture values" surfaces
 * the answers the form would collect, and those answers feed the calculation
 * tester below so formulas can be checked against them. (The real experiment
 * working flow is a separate, deferred feature.)
 */
export function TemplatePreview({ template }: TemplatePreviewProps) {
  const t = useTranslations("builder.preview");
  const [clientAnswers, setClientAnswers] = useState<FormAnswers | null>(null);
  const [labAnswers, setLabAnswers] = useState<FormAnswers | null>(null);
  const capturedValues = { ...(clientAnswers ?? {}), ...(labAnswers ?? {}) };

  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Text size="sm" fw={700} tt="uppercase" c="dimmed">
          {t("clientForm")}
        </Text>
        <FormRenderer
          doc={template.clientForm}
          submitLabel={t("capture")}
          onSubmit={(answers) => setClientAnswers(answers)}
        />
        {clientAnswers && (
          <div>
            <Text size="xs" c="dimmed" mb={4}>
              {t("capturedClient")}
            </Text>
            <Code block>{JSON.stringify(clientAnswers, null, 2)}</Code>
          </div>
        )}
      </Stack>

      <Divider />

      <Stack gap="sm">
        <Text size="sm" fw={700} tt="uppercase" c="dimmed">
          {t("labForm")}
        </Text>
        <FormRenderer
          doc={template.labForm}
          submitLabel={t("capture")}
          onSubmit={(answers) => setLabAnswers(answers)}
        />
        {labAnswers && (
          <div>
            <Text size="xs" c="dimmed" mb={4}>
              {t("capturedLab")}
            </Text>
            <Code block>{JSON.stringify(labAnswers, null, 2)}</Code>
          </div>
        )}
      </Stack>

      <Divider />

      <CalculationTester template={template} values={capturedValues} />
    </Stack>
  );
}
