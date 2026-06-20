"use client";

import {
  ActionIcon,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";

import type { FormDraft } from "@/lib/builder";

interface CalculationsEditorProps {
  form: UseFormReturnType<FormDraft>;
}

export function CalculationsEditor({ form }: CalculationsEditorProps) {
  const calcs = form.values.calculations;

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <div>
          <Title order={3}>Calculations</Title>
          <Text size="sm" c="dimmed">
            Each calculation is a Python formula string evaluated by the
            backend; results are display-only here.
          </Text>
        </div>
        {calcs.length === 0 && (
          <Text size="sm" c="dimmed">
            No calculations yet.
          </Text>
        )}
        {calcs.map((_, i) => (
          <Group key={i} gap="xs" wrap="nowrap" align="flex-end">
            <TextInput
              label={i === 0 ? "Name" : undefined}
              placeholder="totalCost"
              style={{ flex: 1 }}
              {...form.getInputProps(`calculations.${i}.name`)}
            />
            <TextInput
              label={i === 0 ? "Formula" : undefined}
              placeholder="mean(values['reading_a'])"
              style={{ flex: 2 }}
              {...form.getInputProps(`calculations.${i}.formula`)}
            />
            <ActionIcon
              color="red"
              variant="subtle"
              onClick={() => form.removeListItem("calculations", i)}
              aria-label="Remove calculation"
            >
              ✕
            </ActionIcon>
          </Group>
        ))}
        <Group>
          <Button
            size="xs"
            variant="light"
            onClick={() =>
              form.insertListItem("calculations", { name: "", formula: "" })
            }
          >
            Add calculation
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
