"use client";

import type { Question, QuestionType } from "@repo/forms";
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Collapse,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useState } from "react";

import {
  type FormDraft,
  makeNestedQuestion,
  makeQuestion,
  NESTED_QUESTION_TYPE_OPTIONS,
  QUESTION_TYPE_OPTIONS,
} from "@/lib/builder";

import { checkboxProps, numberProps, textProps } from "./fieldProps";
import { OptionsEditor } from "./OptionsEditor";

interface QuestionEditorProps {
  form: UseFormReturnType<FormDraft>;
  path: string;
  question: Question;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  nested?: boolean;
  /** Start expanded — used to open a just-added question for editing. */
  defaultExpanded?: boolean;
}

export function QuestionEditor({
  form,
  path,
  question,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  nested = false,
  defaultExpanded = false,
}: QuestionEditorProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Track which child question was just added, so it opens expanded.
  const [lastAddedChild, setLastAddedChild] = useState<number | null>(null);

  const handleTypeChange = (next: QuestionType) => {
    const base = {
      id: question.id,
      label: question.label,
      description: question.description,
      required: question.required,
    };
    const fresh = nested
      ? makeNestedQuestion(
          next as Exclude<QuestionType, "repeatable-group">,
          base,
        )
      : makeQuestion(next, base);
    form.setFieldValue(path, fresh);
  };

  const summary = question.label?.trim() || question.id?.trim() || "Untitled question";

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <UnstyledButton
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{ flex: 1, minWidth: 0 }}
        >
          <Group gap="xs" wrap="nowrap">
            <Text c="dimmed" w={12} ta="center" aria-hidden>
              {expanded ? "▾" : "▸"}
            </Text>
            <Text size="sm" fw={600} c="dimmed">
              #{index + 1}
            </Text>
            <Text size="sm" fw={500} truncate>
              {summary}
            </Text>
            <Badge size="xs" variant="light" radius="sm" tt="none">
              {question.type}
            </Badge>
            {question.required && (
              <Badge size="xs" color="red" variant="light" radius="sm">
                required
              </Badge>
            )}
          </Group>
        </UnstyledButton>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="Move up"
          >
            ↑
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="Move down"
          >
            ↓
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={onRemove}
            aria-label="Remove question"
          >
            ✕
          </ActionIcon>
        </Group>
      </Group>

      <Collapse expanded={expanded}>
        <Stack gap="sm" pt="md">
          <Group gap="sm" grow>
            <TextInput
              label="ID"
              placeholder="snake_case identifier"
              required
              {...textProps(form, `${path}.id`)}
            />
            <Select
              label="Type"
              data={
                nested ? NESTED_QUESTION_TYPE_OPTIONS : QUESTION_TYPE_OPTIONS
              }
              value={question.type}
              onChange={(v) => v && handleTypeChange(v as QuestionType)}
              allowDeselect={false}
            />
          </Group>

          <TextInput
            label="Label"
            required
            {...textProps(form, `${path}.label`)}
          />
          <TextInput
            label="Description"
            {...textProps(form, `${path}.description`)}
          />
          <Checkbox
            label="Required"
            {...checkboxProps(form, `${path}.required`)}
          />

          <TypeSpecificFields
            form={form}
            path={path}
            question={question}
            lastAddedChild={lastAddedChild}
            onAddChild={setLastAddedChild}
          />
        </Stack>
      </Collapse>
    </Paper>
  );
}

interface TypeSpecificFieldsProps {
  form: UseFormReturnType<FormDraft>;
  path: string;
  question: Question;
  /** Index of the most recently added child (repeatable-group) to auto-expand. */
  lastAddedChild?: number | null;
  onAddChild?: (index: number) => void;
}

function TypeSpecificFields({
  form,
  path,
  question,
  lastAddedChild,
  onAddChild,
}: TypeSpecificFieldsProps) {
  switch (question.type) {
    case "string":
      return (
        <>
          <TextInput
            label="Placeholder"
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <TextInput
            label="Default value"
            {...textProps(form, `${path}.config.default`)}
          />
          <Group grow>
            <NumberInput
              label="Min length"
              {...numberProps(form, `${path}.config.minLength`)}
            />
            <NumberInput
              label="Max length"
              {...numberProps(form, `${path}.config.maxLength`)}
            />
          </Group>
        </>
      );
    case "textarea":
      return (
        <>
          <TextInput
            label="Placeholder"
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <TextInput
            label="Default value"
            {...textProps(form, `${path}.config.default`)}
          />
          <Group grow>
            <NumberInput
              label="Min length"
              {...numberProps(form, `${path}.config.minLength`)}
            />
            <NumberInput
              label="Max length"
              {...numberProps(form, `${path}.config.maxLength`)}
            />
            <NumberInput
              label="Min rows"
              {...numberProps(form, `${path}.config.minRows`)}
            />
            <NumberInput
              label="Max rows"
              {...numberProps(form, `${path}.config.maxRows`)}
            />
          </Group>
        </>
      );
    case "password":
      return (
        <>
          <TextInput
            label="Placeholder"
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <Group grow>
            <NumberInput
              label="Min length"
              {...numberProps(form, `${path}.config.minLength`)}
            />
            <NumberInput
              label="Max length"
              {...numberProps(form, `${path}.config.maxLength`)}
            />
          </Group>
        </>
      );
    case "number":
      return (
        <>
          <TextInput
            label="Placeholder"
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <Group grow>
            <NumberInput
              label="Default value"
              {...numberProps(form, `${path}.config.default`)}
            />
            <NumberInput
              label="Min"
              {...numberProps(form, `${path}.config.min`)}
            />
            <NumberInput
              label="Max"
              {...numberProps(form, `${path}.config.max`)}
            />
            <NumberInput
              label="Step"
              {...numberProps(form, `${path}.config.step`)}
            />
          </Group>
        </>
      );
    case "select-string":
      return (
        <>
          <TextInput
            label="Placeholder"
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <TextInput
            label="Default value"
            {...textProps(form, `${path}.config.default`)}
          />
          <OptionsEditor
            form={form}
            path={`${path}.config.options`}
            valueType="string"
            count={question.config.options.length}
          />
        </>
      );
    case "select-number":
      return (
        <>
          <TextInput
            label="Placeholder"
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <NumberInput
            label="Default value"
            {...numberProps(form, `${path}.config.default`)}
          />
          <OptionsEditor
            form={form}
            path={`${path}.config.options`}
            valueType="number"
            count={question.config.options.length}
          />
        </>
      );
    case "multi-select":
      return (
        <>
          <TextInput
            label="Placeholder"
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <NumberInput
            label="Max selectable values"
            {...numberProps(form, `${path}.config.maxValues`)}
          />
          <OptionsEditor
            form={form}
            path={`${path}.config.options`}
            valueType="string"
            count={question.config.options.length}
          />
        </>
      );
    case "radio":
      return (
        <>
          <TextInput
            label="Default value"
            {...textProps(form, `${path}.config.default`)}
          />
          <OptionsEditor
            form={form}
            path={`${path}.config.options`}
            valueType="string"
            count={question.config.options.length}
          />
        </>
      );
    case "checkbox-group":
      return (
        <OptionsEditor
          form={form}
          path={`${path}.config.options`}
          valueType="string"
          count={question.config.options.length}
        />
      );
    case "boolean":
      return (
        <Checkbox
          label="Default checked"
          {...checkboxProps(form, `${path}.config.default`)}
        />
      );
    case "segmented":
      return (
        <>
          <TextInput
            label="Default value"
            {...textProps(form, `${path}.config.default`)}
          />
          <OptionsEditor
            form={form}
            path={`${path}.config.options`}
            valueType="string"
            count={question.config.options.length}
          />
        </>
      );
    case "slider":
      return (
        <Group grow>
          <NumberInput
            label="Min"
            required
            {...numberProps(form, `${path}.config.min`)}
          />
          <NumberInput
            label="Max"
            required
            {...numberProps(form, `${path}.config.max`)}
          />
          <NumberInput
            label="Step"
            {...numberProps(form, `${path}.config.step`)}
          />
          <NumberInput
            label="Default value"
            {...numberProps(form, `${path}.config.default`)}
          />
        </Group>
      );
    case "rating":
      return (
        <Group grow>
          <NumberInput
            label="Count (stars)"
            {...numberProps(form, `${path}.config.count`)}
          />
          <NumberInput
            label="Fractions"
            description="2 = half stars"
            {...numberProps(form, `${path}.config.fractions`)}
          />
          <NumberInput
            label="Default value"
            {...numberProps(form, `${path}.config.default`)}
          />
        </Group>
      );
    case "color":
      return (
        <>
          <TextInput
            label="Default value"
            placeholder="#ffffff"
            {...textProps(form, `${path}.config.default`)}
          />
          <TextInput
            label="Placeholder"
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <Select
            label="Format"
            data={["hex", "hexa", "rgb", "rgba", "hsl", "hsla"]}
            clearable
            value={
              (form.getInputProps(`${path}.config.format`).value as
                | string
                | undefined) ?? null
            }
            onChange={(v) =>
              form.setFieldValue(`${path}.config.format`, v ?? undefined)
            }
          />
        </>
      );
    case "date":
      return (
        <Group grow>
          <TextInput
            type="date"
            label="Default"
            {...textProps(form, `${path}.config.default`)}
          />
          <TextInput
            type="date"
            label="Min"
            {...textProps(form, `${path}.config.min`)}
          />
          <TextInput
            type="date"
            label="Max"
            {...textProps(form, `${path}.config.max`)}
          />
        </Group>
      );
    case "time":
      return (
        <Group grow>
          <TextInput
            type="time"
            label="Default"
            {...textProps(form, `${path}.config.default`)}
          />
          <NumberInput
            label="Step (seconds)"
            {...numberProps(form, `${path}.config.step`)}
          />
        </Group>
      );
    case "datetime":
      return (
        <TextInput
          type="datetime-local"
          label="Default"
          {...textProps(form, `${path}.config.default`)}
        />
      );
    case "tags":
      return (
        <>
          <TextInput
            label="Placeholder"
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <NumberInput
            label="Max tags"
            {...numberProps(form, `${path}.config.maxTags`)}
          />
        </>
      );
    case "repeatable-group": {
      const childrenPath = `${path}.config.questions`;
      const children = question.config.questions;
      return (
        <>
          <NumberInput
            label="Repetition count"
            min={1}
            {...numberProps(form, `${path}.config.count`)}
          />
          <TextInput
            label="Item label"
            {...textProps(form, `${path}.config.itemLabel`)}
          />
          <Stack gap="md">
            {children.length === 0 && (
              <Text size="sm" c="dimmed">
                No child questions yet.
              </Text>
            )}
            {children.map((child, j) => (
              <QuestionEditor
                key={j}
                nested
                defaultExpanded={j === lastAddedChild}
                form={form}
                path={`${childrenPath}.${j}`}
                question={child}
                index={j}
                total={children.length}
                onMoveUp={() =>
                  form.reorderListItem(childrenPath, { from: j, to: j - 1 })
                }
                onMoveDown={() =>
                  form.reorderListItem(childrenPath, { from: j, to: j + 1 })
                }
                onRemove={() => form.removeListItem(childrenPath, j)}
              />
            ))}
          </Stack>
          <Button
            size="xs"
            variant="light"
            onClick={() => {
              onAddChild?.(children.length);
              form.insertListItem(childrenPath, makeNestedQuestion("number"));
            }}
          >
            Add child question
          </Button>
        </>
      );
    }
  }
}
