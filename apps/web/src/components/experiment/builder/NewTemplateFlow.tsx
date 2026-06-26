"use client";

import {
  Alert,
  Button,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useState, useTransition } from "react";

import { createSampleAction } from "@/app/actions/experiment-manager";
import { emptyDraft } from "@/lib/builder";

import { BuilderApp } from "./BuilderApp";

interface SampleOption {
  id: string;
  name: string;
}

interface NewTemplateFlowProps {
  samples: SampleOption[];
  /** Pre-select this sample (from `?sampleId=`). */
  presetSampleId?: string;
}

const NEW_SAMPLE_VALUE = "__new__";

/**
 * The sample is already known whenever we arrive here via Page 3's "New
 * template" button (the only place that links here, always with
 * ?sampleId=) — skip straight to the builder, same as before this redesign.
 * `NewTemplateForm` below (the combined sample-picker + template-name form)
 * is only for a standalone entry point with no sample pre-selected — not
 * currently linked anywhere, but kept for that case.
 */
export function NewTemplateFlow({
  samples,
  presetSampleId,
}: NewTemplateFlowProps) {
  const presetSample = samples.find((s) => s.id === presetSampleId);
  if (presetSample) {
    return (
      <BuilderApp
        initial={emptyDraft()}
        mode="create"
        sampleId={presetSample.id}
        sampleName={presetSample.name}
      />
    );
  }

  return <NewTemplateForm initialSamples={samples} />;
}

function NewTemplateForm({
  initialSamples,
}: {
  initialSamples: SampleOption[];
}) {
  const [samples, setSamples] = useState<SampleOption[]>(initialSamples);
  const [sampleChoice, setSampleChoice] = useState<string | null>(null);
  const [newSampleName, setNewSampleName] = useState("");
  const [newSampleDescription, setNewSampleDescription] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [resolved, setResolved] = useState<SampleOption | null>(null);

  if (resolved) {
    return (
      <BuilderApp
        initial={{
          ...emptyDraft(),
          title: templateName.trim(),
          description: templateDescription.trim() || undefined,
        }}
        mode="create"
        sampleId={resolved.id}
        sampleName={resolved.name}
      />
    );
  }

  const isNewSample = sampleChoice === NEW_SAMPLE_VALUE;
  const canSubmit =
    sampleChoice != null &&
    (!isNewSample || newSampleName.trim().length > 0) &&
    templateName.trim().length > 0;

  function handleSubmit() {
    if (!sampleChoice) {
      setError("Please select a sample.");
      return;
    }
    if (isNewSample && !newSampleName.trim()) {
      setError("New sample name is required.");
      return;
    }
    if (!templateName.trim()) {
      setError("Template name is required.");
      return;
    }
    setError(null);

    if (!isNewSample) {
      const sample = samples.find((s) => s.id === sampleChoice);
      if (!sample) return;
      setResolved(sample);
      return;
    }

    startTransition(async () => {
      const result = await createSampleAction(
        newSampleName.trim(),
        newSampleDescription.trim(),
      );
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSamples((prev) => [...prev, result.data]);
      setResolved(result.data);
    });
  }

  return (
    <Stack gap="md" maw={560}>
      <Title order={2}>New template</Title>
      <Text c="dimmed">
        Fill in the details below to create a new experiment template.
      </Text>

      {error && (
        <Alert color="red" variant="light" title="Error">
          <Text size="sm" style={{ whiteSpace: "pre-line" }}>
            {error}
          </Text>
        </Alert>
      )}

      <Paper withBorder p="lg" radius="md">
        <Stack gap="md">
          <Select
            label="Sample"
            description="The specimen type this template belongs to."
            placeholder="— Choose a sample —"
            data={[
              ...samples.map((s) => ({ value: s.id, label: s.name })),
              { value: NEW_SAMPLE_VALUE, label: "+ Create new sample…" },
            ]}
            value={sampleChoice}
            onChange={(v) => {
              setSampleChoice(v);
              setError(null);
            }}
            searchable
            required
          />

          {isNewSample && (
            <Stack
              gap="sm"
              p="sm"
              style={{
                background: "var(--mantine-color-green-0)",
                border: "1px solid var(--mantine-color-green-3)",
                borderRadius: "var(--mantine-radius-md)",
              }}
            >
              <Text size="xs" fw={700} c="green.8" tt="uppercase">
                New sample details
              </Text>
              <TextInput
                label="Sample name"
                required
                placeholder="e.g. Soil"
                value={newSampleName}
                onChange={(e) => {
                  setNewSampleName(e.currentTarget.value);
                  setError(null);
                }}
              />
              <TextInput
                label="Description"
                placeholder="Optional"
                value={newSampleDescription}
                onChange={(e) => setNewSampleDescription(e.currentTarget.value)}
              />
            </Stack>
          )}

          <TextInput
            label="Template name"
            description="A short descriptive name for this template."
            required
            placeholder="e.g. Moisture Analysis"
            value={templateName}
            onChange={(e) => {
              setTemplateName(e.currentTarget.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
          />

          <TextInput
            label="Description"
            placeholder="What does this template measure or test?"
            value={templateDescription}
            onChange={(e) => setTemplateDescription(e.currentTarget.value)}
          />

          <Button
            onClick={handleSubmit}
            loading={isPending}
            disabled={!canSubmit}
            fullWidth
            color="green"
          >
            Create template →
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
