"use client";

import {
  Alert,
  Button,
  Divider,
  Group,
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
  /** Pre-select this sample (from `?sampleId=`) and jump straight to the builder. */
  presetSampleId?: string;
}

export function NewTemplateFlow({
  samples: initialSamples,
  presetSampleId,
}: NewTemplateFlowProps) {
  const [samples, setSamples] = useState<SampleOption[]>(initialSamples);
  const [selectedId, setSelectedId] = useState<string | null>(
    presetSampleId && initialSamples.some((s) => s.id === presetSampleId)
      ? presetSampleId
      : null,
  );

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = samples.find((s) => s.id === selectedId);

  if (selected) {
    return (
      <BuilderApp
        initial={emptyDraft()}
        mode="create"
        sampleId={selected.id}
        sampleName={selected.name}
      />
    );
  }

  const createSample = () => {
    setError(null);
    startTransition(async () => {
      const result = await createSampleAction(newName, newDescription);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSamples((prev) => [...prev, result.data]);
      setSelectedId(result.data.id);
    });
  };

  return (
    <Stack gap="md" maw={560}>
      <Title order={2}>New template</Title>
      <Text c="dimmed">
        Templates belong to a sample type. Pick the sample this template is for,
        or create a new one.
      </Text>

      {error && (
        <Alert color="red" variant="light" title="Error">
          <Text size="sm" style={{ whiteSpace: "pre-line" }}>
            {error}
          </Text>
        </Alert>
      )}

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Title order={4}>Use an existing sample</Title>
          {samples.length === 0 ? (
            <Text size="sm" c="dimmed">
              No samples yet — create one below.
            </Text>
          ) : (
            <Group align="flex-end">
              <Select
                label="Sample"
                placeholder="Choose a sample"
                style={{ flex: 1 }}
                data={samples.map((s) => ({ value: s.id, label: s.name }))}
                value={selectedId}
                onChange={setSelectedId}
                searchable
              />
              <Button
                disabled={!selectedId}
                onClick={() => setSelectedId(selectedId)}
              >
                Continue
              </Button>
            </Group>
          )}
        </Stack>
      </Paper>

      <Divider label="or" labelPosition="center" />

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Title order={4}>Create a new sample</Title>
          <TextInput
            label="Name"
            required
            placeholder="e.g. Coal"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
          />
          <TextInput
            label="Description"
            placeholder="Optional"
            value={newDescription}
            onChange={(e) => setNewDescription(e.currentTarget.value)}
          />
          <Group>
            <Button
              onClick={createSample}
              loading={isPending}
              disabled={!newName.trim()}
            >
              Create sample &amp; continue
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
