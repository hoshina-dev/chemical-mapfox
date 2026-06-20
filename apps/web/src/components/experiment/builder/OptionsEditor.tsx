"use client";

import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";

import type { FormDraft } from "@/lib/builder";

interface OptionsEditorProps {
  form: UseFormReturnType<FormDraft>;
  path: string;
  valueType: "string" | "number";
  count: number;
}

export function OptionsEditor({
  form,
  path,
  valueType,
  count,
}: OptionsEditorProps) {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Options
      </Text>
      {count === 0 && (
        <Text size="xs" c="dimmed">
          No options yet.
        </Text>
      )}
      {Array.from({ length: count }).map((_, i) => (
        <Group key={i} gap="xs" wrap="nowrap">
          <TextInput
            placeholder="Label"
            style={{ flex: 1 }}
            {...form.getInputProps(`${path}.${i}.label`)}
          />
          {valueType === "string" ? (
            <TextInput
              placeholder="Value"
              style={{ flex: 1 }}
              {...form.getInputProps(`${path}.${i}.value`)}
            />
          ) : (
            <NumberInput
              placeholder="Value"
              style={{ flex: 1 }}
              {...form.getInputProps(`${path}.${i}.value`)}
            />
          )}
          <ActionIcon
            color="red"
            variant="subtle"
            onClick={() => form.removeListItem(path, i)}
            aria-label="Remove option"
          >
            ✕
          </ActionIcon>
        </Group>
      ))}
      <Button
        size="xs"
        variant="light"
        style={{ alignSelf: "flex-start" }}
        onClick={() =>
          form.insertListItem(
            path,
            valueType === "string"
              ? { label: "", value: "" }
              : { label: "", value: 0 },
          )
        }
      >
        Add option
      </Button>
    </Stack>
  );
}
