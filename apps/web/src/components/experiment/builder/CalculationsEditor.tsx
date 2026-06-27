"use client";

import { useState } from "react";
import {
  ActionIcon,
  Button,
  Code,
  Divider,
  Drawer,
  Group,
  Input,
  List,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";

import type { FormDraft } from "@/lib/builder";

import { CollapsiblePanel } from "./CollapsiblePanel";
import { CompactFormulaEditor } from "./CompactFormulaEditor";
import { MonacoFormulaEditor } from "./MonacoFormulaEditor";

interface CalculationsEditorProps {
  form: UseFormReturnType<FormDraft>;
}

interface CalcRowProps {
  isFirst: boolean;
  formula: string;
  onFormulaChange: (value: string) => void;
  onExpand: () => void;
  nameProps: ReturnType<UseFormReturnType<FormDraft>["getInputProps"]>;
  onDelete: () => void;
}

function CalcRow({
  isFirst,
  formula,
  onFormulaChange,
  onExpand,
  nameProps,
  onDelete,
}: CalcRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <TextInput
        label={isFirst ? "Name" : undefined}
        placeholder="totalCost"
        style={{ flex: 1 }}
        {...nameProps}
      />
      <Input.Wrapper label={isFirst ? "Formula" : undefined} style={{ flex: 2 }}>
        <CompactFormulaEditor
          value={formula}
          onChange={onFormulaChange}
          onExpand={onExpand}
          placeholder="mean(values['reading_a'])"
        />
      </Input.Wrapper>
      <Group gap={4} wrap="nowrap" mt={isFirst ? 25 : 0}>
        <Tooltip label="Open code editor">
          <ActionIcon variant="subtle" onClick={onExpand} aria-label="Open code editor">
            ⤢
          </ActionIcon>
        </Tooltip>
        {confirmDelete ? (
          <Group gap={4} wrap="nowrap">
            <Text size="xs" c="red" fw={600}>
              Delete?
            </Text>
            <Button size="compact-xs" color="red" onClick={onDelete}>
              Yes
            </Button>
            <Button
              size="compact-xs"
              variant="default"
              onClick={() => setConfirmDelete(false)}
            >
              No
            </Button>
          </Group>
        ) : (
          <ActionIcon
            color="red"
            variant="subtle"
            onClick={() => setConfirmDelete(true)}
            aria-label="Remove calculation"
          >
            ✕
          </ActionIcon>
        )}
      </Group>
    </Group>
  );
}

export function CalculationsEditor({ form }: CalculationsEditorProps) {
  const calcs = form.values.calculations;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const activeCalc = activeIndex === null ? null : calcs[activeIndex];

  return (
    <CollapsiblePanel
      title="Calculations"
      subtitle="Each calculation is a Python formula string evaluated by the backend; results are display-only here."
      badge={`${calcs.length} formula${calcs.length === 1 ? "" : "s"}`}
    >
      <Stack gap="sm" style={{ width: "100%" }}>
        {calcs.length === 0 && (
          <Text size="sm" c="dimmed">
            No calculations yet.
          </Text>
        )}
        {calcs.map((calc, i) => (
          <CalcRow
            key={i}
            isFirst={i === 0}
            formula={calc.formula}
            onFormulaChange={(value) =>
              form.setFieldValue(`calculations.${i}.formula`, value)
            }
            onExpand={() => setActiveIndex(i)}
            nameProps={form.getInputProps(`calculations.${i}.name`)}
            onDelete={() => form.removeListItem("calculations", i)}
          />
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
    </CollapsiblePanel>
  );
}
