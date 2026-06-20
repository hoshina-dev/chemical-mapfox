"use client";

import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createSampleAction } from "@/app/actions/experiment-manager";
import { sampleOnboardingPath } from "@/lib/experiment-manager/routes";

export function RegisterSampleButton() {
  const [opened, { open, close }] = useDisclosure(false);
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setDescription("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createSampleAction(name, description);
      if (!result.success) {
        setError(result.error);
        return;
      }
      close();
      reset();
      router.push(sampleOnboardingPath(result.data.id));
    });
  }

  return (
    <>
      <Button onClick={open}>Register sample</Button>
      <Modal
        opened={opened}
        onClose={close}
        title="Register a new sample"
        centered
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            A sample is a specimen type (e.g. Coal). Experiment templates are
            created under it.
          </Text>
          {error && (
            <Alert color="red" variant="light" title="Could not create sample">
              <Text size="sm" style={{ whiteSpace: "pre-line" }}>
                {error}
              </Text>
            </Alert>
          )}
          <TextInput
            label="Name"
            required
            placeholder="e.g. Coal"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label="Description"
            placeholder="Optional"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button onClick={submit} loading={isPending} disabled={!name.trim()}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
