"use client";

import { ExperimentTemplate } from "@repo/forms";
import {
  Alert,
  Button,
  Code,
  Drawer,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createTemplateAction,
  deleteTemplateAction,
  updateTemplateAction,
} from "@/app/actions/experiment-manager";
import { type FormDraft, fromDraft } from "@/lib/builder";
import { onboardingPath, templateBuilderPath } from "@/lib/experiment-manager/routes";

import { CalculationsEditor } from "./CalculationsEditor";
import { textProps } from "./fieldProps";
import { SectionEditor } from "./SectionEditor";
import { TemplatePreview } from "./TemplatePreview";

interface BuilderAppProps {
  initial: FormDraft;
  mode: "create" | "edit";
  sampleId: string;
  sampleName?: string;
  templateId?: string;
  /** Stable lineage id — required for PUT updates in edit mode. */
  lineageId?: string;
}

export function BuilderApp({
  initial,
  mode,
  sampleId,
  sampleName,
  templateId,
  lineageId,
}: BuilderAppProps) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [debugPayload, setDebugPayload] = useState<unknown>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormDraft>({
    initialValues: initial,
  });

  const draftTemplate = previewOpen ? safeTemplate(form.values) : null;

  const save = () => {
    const { meta, template } = fromDraft(form.values);
    const parsed = ExperimentTemplate.safeParse(template);
    if (!parsed.success) {
      setSaveError("Fix validation errors before saving.");
      setDebugPayload({ meta, template, validationErrors: parsed.error.format() });
      return;
    }
    setSaveError(null);
    setDebugPayload(null);
    const payload = { meta, template: parsed.data };
    startTransition(async () => {
      if (mode === "create") {
        const result = await createTemplateAction(sampleId, payload);
        if (!result.success) {
          setSaveError(result.error);
          setDebugPayload({ sampleId, ...payload });
          return;
        }
        router.push(templateBuilderPath({ sampleId, templateId: result.data.id }));
        router.refresh();
        return;
      }
      if (!templateId || !lineageId) return;
      const result = await updateTemplateAction(
        { sampleId, templateId },
        payload,
        lineageId,
      );
      if (!result.success) {
        setSaveError(result.error);
        setDebugPayload({ sampleId, templateId, lineageId, ...payload });
        return;
      }
      if (result.data.id !== templateId) {
        router.push(
          templateBuilderPath({ sampleId, templateId: result.data.id }),
        );
      }
      router.refresh();
    });
  };

  const remove = () => {
    if (!templateId) return;
    if (!window.confirm("Delete this experiment template?")) return;
    startTransition(async () => {
      const result = await deleteTemplateAction({ sampleId, templateId });
      if (!result.success) {
        setSaveError(result.error);
        setDebugPayload({ sampleId, templateId });
        return;
      }
      router.push(onboardingPath());
      router.refresh();
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>
          {mode === "create"
            ? "New template"
            : `Edit: ${form.values.title || initial.title}`}
        </Title>
        <Button variant="subtle" component={Link} href={onboardingPath()}>
          Back to templates
        </Button>
      </Group>

      {saveError && (
        <Alert color="red" variant="light" title="Save failed">
          <Stack gap="xs">
            <Text size="sm" style={{ whiteSpace: "pre-line" }}>
              {saveError}
            </Text>
            {debugPayload != null && (
              <>
                <Text size="xs" c="dimmed" fw={600}>
                  Payload (for debugging)
                </Text>
                <Code
                  block
                  style={{ maxHeight: 320, overflow: "auto", whiteSpace: "pre" }}
                >
                  {JSON.stringify(debugPayload, null, 2)}
                </Code>
              </>
            )}
          </Stack>
        </Alert>
      )}

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Title order={3}>Metadata</Title>
          {sampleName && (
            <Text size="sm">
              This template is associated with sample{" "}
              <Text span fw={600}>
                {sampleName}
              </Text>
              .
            </Text>
          )}
          {mode === "edit" && templateId && (
            <TextInput label="Template ID" value={templateId} disabled />
          )}
          <TextInput label="Name" required {...textProps(form, "title")} />
          <TextInput label="Description" {...textProps(form, "description")} />
        </Stack>
      </Paper>

      <SectionEditor form={form} path="clientForm" />
      <SectionEditor form={form} path="labForm" />
      <CalculationsEditor form={form} />

      <Group
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--mantine-color-body)",
          padding: "var(--mantine-spacing-sm) 0",
          borderTop: "1px solid var(--mantine-color-default-border)",
          zIndex: 1,
        }}
      >
        <Button variant="default" onClick={() => setPreviewOpen(true)}>
          Live preview
        </Button>
        <Button onClick={save} loading={isPending}>
          {mode === "create" ? "Create template" : "Save changes"}
        </Button>
        {mode === "edit" && templateId && (
          <Button
            color="red"
            variant="light"
            onClick={remove}
            loading={isPending}
          >
            Delete
          </Button>
        )}
      </Group>

      <Drawer
        opened={previewOpen}
        onClose={() => setPreviewOpen(false)}
        position="right"
        size="xl"
        title="Live preview"
      >
        {draftTemplate ? (
          <TemplatePreview template={draftTemplate} />
        ) : (
          <Alert color="red" variant="light" title="Draft is not valid">
            Fix the schema before previewing.
          </Alert>
        )}
      </Drawer>
    </Stack>
  );
}

function safeTemplate(draft: FormDraft): ExperimentTemplate | null {
  const { template } = fromDraft(draft);
  const parsed = ExperimentTemplate.safeParse(template);
  if (!parsed.success) return null;
  return parsed.data;
}
