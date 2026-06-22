"use client";

import { useState } from "react";
import {
  ActionIcon,
  Button,
  Code,
  Divider,
  Drawer,
  Group,
  List,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";

import type { FormDraft } from "@/lib/builder";

import { MonacoFormulaEditor } from "./MonacoFormulaEditor";

interface CalculationsEditorProps {
  form: UseFormReturnType<FormDraft>;
}

export function CalculationsEditor({ form }: CalculationsEditorProps) {
  const calcs = form.values.calculations;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const activeCalc = activeIndex === null ? null : calcs[activeIndex];

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
          <Group key={i} gap="xs" wrap="nowrap" align="flex-start">
            <TextInput
              label={i === 0 ? "Name" : undefined}
              placeholder="totalCost"
              style={{ flex: 1 }}
              {...form.getInputProps(`calculations.${i}.name`)}
            />
            <Textarea
              label={i === 0 ? "Formula" : undefined}
              placeholder="mean(values['reading_a'])"
              autosize
              minRows={1}
              maxRows={8}
              style={{ flex: 2 }}
              styles={{
                input: {
                  fontFamily: "var(--mantine-font-family-monospace)",
                  fontSize: "var(--mantine-font-size-sm)",
                },
              }}
              {...form.getInputProps(`calculations.${i}.formula`)}
            />
            <Group gap={4} wrap="nowrap" mt={i === 0 ? 25 : 0}>
              <Tooltip label="Open code editor">
                <ActionIcon
                  variant="subtle"
                  onClick={() => setActiveIndex(i)}
                  aria-label="Open code editor"
                >
                  ⤢
                </ActionIcon>
              </Tooltip>
              <ActionIcon
                color="red"
                variant="subtle"
                onClick={() => form.removeListItem("calculations", i)}
                aria-label="Remove calculation"
              >
                ✕
              </ActionIcon>
            </Group>
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

      <Drawer
        opened={activeIndex !== null}
        onClose={() => setActiveIndex(null)}
        position="right"
        size="lg"
        title={
          <Text fw={600}>
            Edit formula{activeCalc?.name ? `: ${activeCalc.name}` : ""}
          </Text>
        }
      >
        {activeIndex !== null && activeCalc && (
          <Stack gap="sm">
            <MonacoFormulaEditor
              value={activeCalc.formula}
              onChange={(value) =>
                form.setFieldValue(`calculations.${activeIndex}.formula`, value)
              }
            />

            <Divider />

            <div>
              <Text size="sm" fw={600}>
                Available in formulas
              </Text>
              <List size="xs" spacing={2} mt={4}>
                <List.Item>
                  <Code>values[&apos;question_id&apos;]</Code> — answers from the
                  client/lab forms
                </List.Item>
                <List.Item>
                  Other calculation names (defined above) can be referenced
                  directly
                </List.Item>
                <List.Item>
                  <Code>math</Code> module (e.g. <Code>math.sqrt</Code>,{" "}
                  <Code>math.pi</Code>)
                </List.Item>
                <List.Item>
                  Builtins: <Code>round</Code>, <Code>abs</Code>,{" "}
                  <Code>min</Code>, <Code>max</Code>, <Code>sum</Code>,{" "}
                  <Code>len</Code>, <Code>zip</Code>, <Code>mean</Code>,{" "}
                  <Code>median</Code>, <Code>stdev</Code>
                </List.Item>
              </List>
              <Text size="xs" c="dimmed" mt={6}>
                You can write multiple lines: the final line is used as the
                result, or assign it to a <Code>result</Code> variable. Dunder (
                <Code>__</Code>) access is rejected by the backend.
              </Text>
            </div>

            <Group justify="flex-end">
              <Button onClick={() => setActiveIndex(null)}>Done</Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </Paper>
  );
}
