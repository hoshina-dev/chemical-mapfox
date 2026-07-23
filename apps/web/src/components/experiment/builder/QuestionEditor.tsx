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
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  type FormDraft,
  getNestedQuestionTypeOptions,
  getQuestionTypeOptions,
  makeNestedQuestion,
  makeQuestion,
  type TranslateFn,
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
}: QuestionEditorProps) {
  const t = useTranslations("builder");
  // Questions default to expanded — matches the design (every question opens
  // expanded; the toggle is for collapsing ones you're not editing).
  const [expanded, setExpanded] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const summary =
    question.label?.trim() || question.id?.trim() || t("question.untitled");

  return (
    <Paper withBorder p="md" radius="md" style={{ width: "100%" }}>
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
                {t("question.required")}
              </Badge>
            )}
          </Group>
        </UnstyledButton>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label={t("question.moveUp")}
          >
            ↑
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label={t("question.moveDown")}
          >
            ↓
          </ActionIcon>
          {confirmDelete ? (
            <Group gap={4} wrap="nowrap">
              <Text size="xs" c="red" fw={600}>
                {t("question.deleteConfirm")}
              </Text>
              <Button size="compact-xs" color="red" onClick={onRemove}>
                {t("question.yes")}
              </Button>
              <Button
                size="compact-xs"
                variant="default"
                onClick={() => setConfirmDelete(false)}
              >
                {t("question.no")}
              </Button>
            </Group>
          ) : (
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => setConfirmDelete(true)}
              aria-label={t("question.remove")}
            >
              ✕
            </ActionIcon>
          )}
        </Group>
      </Group>

      <Collapse expanded={expanded} style={{ width: "100%" }}>
        <Stack gap="sm" pt="md" style={{ width: "100%" }}>
          <Group gap="sm" grow>
            <TextInput
              label={t("question.id")}
              placeholder={t("question.idPlaceholder")}
              required
              {...textProps(form, `${path}.id`)}
            />
            <Select
              label={t("question.type")}
              data={
                nested
                  ? getNestedQuestionTypeOptions(t as TranslateFn)
                  : getQuestionTypeOptions(t as TranslateFn)
              }
              value={question.type}
              onChange={(v) => v && handleTypeChange(v as QuestionType)}
              allowDeselect={false}
            />
          </Group>

          <TextInput
            label={t("question.label")}
            required
            {...textProps(form, `${path}.label`)}
          />
          <TextInput
            label={t("question.description")}
            {...textProps(form, `${path}.description`)}
          />
          <Checkbox
            label={t("question.requiredLabel")}
            {...checkboxProps(form, `${path}.required`)}
          />

          <TypeSpecificFields form={form} path={path} question={question} />
        </Stack>
      </Collapse>
    </Paper>
  );
}

interface TypeSpecificFieldsProps {
  form: UseFormReturnType<FormDraft>;
  path: string;
  question: Question;
}

function TypeSpecificFields({
  form,
  path,
  question,
}: TypeSpecificFieldsProps) {
  const t = useTranslations("builder");
  switch (question.type) {
    case "string":
      return (
        <>
          <TextInput
            label={t("question.placeholder")}
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <TextInput
            label={t("question.defaultValue")}
            {...textProps(form, `${path}.config.default`)}
          />
          <Group grow>
            <NumberInput
              label={t("question.minLength")}
              {...numberProps(form, `${path}.config.minLength`)}
            />
            <NumberInput
              label={t("question.maxLength")}
              {...numberProps(form, `${path}.config.maxLength`)}
            />
          </Group>
        </>
      );
    case "textarea":
      return (
        <>
          <TextInput
            label={t("question.placeholder")}
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <TextInput
            label={t("question.defaultValue")}
            {...textProps(form, `${path}.config.default`)}
          />
          <Group grow>
            <NumberInput
              label={t("question.minLength")}
              {...numberProps(form, `${path}.config.minLength`)}
            />
            <NumberInput
              label={t("question.maxLength")}
              {...numberProps(form, `${path}.config.maxLength`)}
            />
            <NumberInput
              label={t("question.minRows")}
              {...numberProps(form, `${path}.config.minRows`)}
            />
            <NumberInput
              label={t("question.maxRows")}
              {...numberProps(form, `${path}.config.maxRows`)}
            />
          </Group>
        </>
      );
    case "password":
      return (
        <>
          <TextInput
            label={t("question.placeholder")}
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <Group grow>
            <NumberInput
              label={t("question.minLength")}
              {...numberProps(form, `${path}.config.minLength`)}
            />
            <NumberInput
              label={t("question.maxLength")}
              {...numberProps(form, `${path}.config.maxLength`)}
            />
          </Group>
        </>
      );
    case "number":
      return (
        <>
          <TextInput
            label={t("question.placeholder")}
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <Group grow>
            <NumberInput
              label={t("question.defaultValue")}
              {...numberProps(form, `${path}.config.default`)}
            />
            <NumberInput
              label={t("question.min")}
              {...numberProps(form, `${path}.config.min`)}
            />
            <NumberInput
              label={t("question.max")}
              {...numberProps(form, `${path}.config.max`)}
            />
            <NumberInput
              label={t("question.step")}
              {...numberProps(form, `${path}.config.step`)}
            />
          </Group>
        </>
      );
    case "select-string":
      return (
        <>
          <TextInput
            label={t("question.placeholder")}
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <TextInput
            label={t("question.defaultValue")}
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
            label={t("question.placeholder")}
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <NumberInput
            label={t("question.defaultValue")}
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
            label={t("question.placeholder")}
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <NumberInput
            label={t("question.maxSelectable")}
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
            label={t("question.defaultValue")}
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
          label={t("question.defaultChecked")}
          {...checkboxProps(form, `${path}.config.default`)}
        />
      );
    case "segmented":
      return (
        <>
          <TextInput
            label={t("question.defaultValue")}
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
            label={t("question.min")}
            required
            {...numberProps(form, `${path}.config.min`)}
          />
          <NumberInput
            label={t("question.max")}
            required
            {...numberProps(form, `${path}.config.max`)}
          />
          <NumberInput
            label={t("question.step")}
            {...numberProps(form, `${path}.config.step`)}
          />
          <NumberInput
            label={t("question.defaultValue")}
            {...numberProps(form, `${path}.config.default`)}
          />
        </Group>
      );
    case "rating":
      return (
        <Group grow>
          <NumberInput
            label={t("question.count")}
            {...numberProps(form, `${path}.config.count`)}
          />
          <NumberInput
            label={t("question.fractions")}
            description={t("question.fractionsDescription")}
            {...numberProps(form, `${path}.config.fractions`)}
          />
          <NumberInput
            label={t("question.defaultValue")}
            {...numberProps(form, `${path}.config.default`)}
          />
        </Group>
      );
    case "color":
      return (
        <>
          <TextInput
            label={t("question.defaultValue")}
            placeholder={t("question.colorPlaceholder")}
            {...textProps(form, `${path}.config.default`)}
          />
          <TextInput
            label={t("question.placeholder")}
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <Select
            label={t("question.format")}
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
            label={t("question.default")}
            {...textProps(form, `${path}.config.default`)}
          />
          <TextInput
            type="date"
            label={t("question.min")}
            {...textProps(form, `${path}.config.min`)}
          />
          <TextInput
            type="date"
            label={t("question.max")}
            {...textProps(form, `${path}.config.max`)}
          />
        </Group>
      );
    case "time":
      return (
        <Group grow>
          <TextInput
            type="time"
            label={t("question.default")}
            {...textProps(form, `${path}.config.default`)}
          />
          <NumberInput
            label={t("question.stepSeconds")}
            {...numberProps(form, `${path}.config.step`)}
          />
        </Group>
      );
    case "datetime":
      return (
        <TextInput
          type="datetime-local"
          label={t("question.default")}
          {...textProps(form, `${path}.config.default`)}
        />
      );
    case "tags":
      return (
        <>
          <TextInput
            label={t("question.placeholder")}
            {...textProps(form, `${path}.config.placeholder`)}
          />
          <NumberInput
            label={t("question.maxTags")}
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
            label={t("question.repetitionCount")}
            min={1}
            {...numberProps(form, `${path}.config.count`)}
          />
          <TextInput
            label={t("question.itemLabel")}
            {...textProps(form, `${path}.config.itemLabel`)}
          />
          <Stack gap="md">
            {children.length === 0 && (
              <Text size="sm" c="dimmed">
                {t("question.noChildQuestions")}
              </Text>
            )}
            {children.map((child, j) => (
              <QuestionEditor
                key={j}
                nested
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
            onClick={() =>
              form.insertListItem(childrenPath, makeNestedQuestion("number"))
            }
          >
            {t("question.addChildQuestion")}
          </Button>
        </>
      );
    }
  }
}
