"use client";

import type { ExperimentTemplate, FormAnswers } from "@repo/forms";
import { FormRenderer } from "@repo/forms";
import { Code, Divider, Stack, Text } from "@mantine/core";
import { useState } from "react";

interface TemplatePreviewProps {
  template: ExperimentTemplate;
}

/**
 * Interactive preview of both forms in a template — fields are editable so the
 * author can try dropdowns, switches, sliders, etc. "Capture values" surfaces
 * the answers the form would collect. (The real experiment working flow is a
 * separate, deferred feature.)
 */
export function TemplatePreview({ template }: TemplatePreviewProps) {
  const [clientAnswers, setClientAnswers] = useState<FormAnswers | null>(null);
  const [labAnswers, setLabAnswers] = useState<FormAnswers | null>(null);

  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Text size="sm" fw={700} tt="uppercase" c="dimmed">
          Client form
        </Text>
        <FormRenderer
          doc={template.clientForm}
          submitLabel="Capture values"
          onSubmit={(answers) => setClientAnswers(answers)}
        />
        {clientAnswers && (
          <div>
            <Text size="xs" c="dimmed" mb={4}>
              Captured client values
            </Text>
            <Code block>{JSON.stringify(clientAnswers, null, 2)}</Code>
          </div>
        )}
      </Stack>

      <Divider />

      <Stack gap="sm">
        <Text size="sm" fw={700} tt="uppercase" c="dimmed">
          Lab form
        </Text>
        <FormRenderer
          doc={template.labForm}
          submitLabel="Capture values"
          onSubmit={(answers) => setLabAnswers(answers)}
        />
        {labAnswers && (
          <div>
            <Text size="xs" c="dimmed" mb={4}>
              Captured lab values
            </Text>
            <Code block>{JSON.stringify(labAnswers, null, 2)}</Code>
          </div>
        )}
      </Stack>
    </Stack>
  );
}
