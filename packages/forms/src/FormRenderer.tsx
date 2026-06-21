"use client";

import {
  Box,
  Button,
  Checkbox,
  ColorInput,
  Group,
  MultiSelect,
  NumberInput,
  PasswordInput,
  Radio,
  Rating,
  SegmentedControl,
  Select,
  Slider,
  Stack,
  Switch,
  Tabs,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useMemo, useState } from "react";

import type {
  AnswerValue,
  FormAnswers,
  Question,
  QuestionId,
  RepeatableGroupQuestion,
} from "./schema";

interface FormRendererProps {
  doc: { title: string; description?: string; questions: Question[] };
  lockedValues?: Record<QuestionId, AnswerValue>;
  initialValues?: FormAnswers;
  readOnly?: boolean;
  /**
   * When false, questions absent from `initialValues` render empty instead of
   * their configured default. Use for read-only views of *stored answers* so
   * the display reflects what's actually saved (not fabricated defaults).
   * Defaults to true (pre-fill), which is what editable forms / previews want.
   */
  fillDefaults?: boolean;
  submitLabel?: string;
  saveDraftLabel?: string;
  onSubmit?: (answers: FormAnswers) => void;
  onSaveDraft?: (answers: FormAnswers) => void;
}

type RepeatableColumn = Exclude<Extract<AnswerValue, unknown[]>, string[]>;

function defaultFor(q: Question): AnswerValue {
  const config = q.config;
  if (config && "default" in config && config.default !== undefined) {
    return config.default as AnswerValue;
  }
  switch (q.type) {
    case "boolean":
      return false;
    case "multi-select":
    case "checkbox-group":
    case "tags":
      return [];
    case "repeatable-group":
      return undefined;
    default:
      return undefined;
  }
}

export interface RepeatableGroupFieldProps {
  question: RepeatableGroupQuestion;
  values: FormAnswers;
  disabled?: boolean;
  onChange: (childId: string, index: number, value: AnswerValue) => void;
}

export function RepeatableGroupField({
  question,
  values,
  disabled,
  onChange,
}: RepeatableGroupFieldProps) {
  const { count, itemLabel, questions: childQuestions } = question.config;

  return (
    <Stack gap="md">
      <Box>
        <Text size="sm" fw={500}>
          {question.label}
          {question.required && (
            <Text component="span" c="red" ml={4}>
              *
            </Text>
          )}
        </Text>
        {question.description && (
          <Text size="xs" c="dimmed">
            {question.description}
          </Text>
        )}
      </Box>

      <Tabs defaultValue="0">
        <Tabs.List>
          {Array.from({ length: count }, (_, i) => (
            <Tabs.Tab key={i} value={String(i)}>
              {itemLabel ?? "Item"} {i + 1}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {Array.from({ length: count }, (_, i) => (
          <Tabs.Panel key={i} value={String(i)} pt="md">
            <Stack gap="sm">
              {childQuestions.map((child) => (
                <QuestionField
                  key={child.id}
                  question={child}
                  value={
                    (values[child.id] as RepeatableColumn | undefined)?.[i]
                  }
                  disabled={disabled}
                  onChange={(v) => onChange(child.id, i, v)}
                />
              ))}
            </Stack>
          </Tabs.Panel>
        ))}
      </Tabs>
    </Stack>
  );
}

export function FormRenderer({
  doc,
  lockedValues = {},
  initialValues = {},
  readOnly = false,
  fillDefaults = true,
  submitLabel = "Submit",
  saveDraftLabel = "Save draft",
  onSubmit,
  onSaveDraft,
}: FormRendererProps) {
  const initialAnswers = useMemo(() => {
    const answers: FormAnswers = {};
    for (const q of doc.questions) {
      if (q.type === "repeatable-group") {
        for (const child of q.config.questions) {
          const column =
            (initialValues[child.id] as RepeatableColumn | undefined) ?? [];
          answers[child.id] = Array.from(
            { length: q.config.count },
            (_, k) => column[k] ?? (fillDefaults ? defaultFor(child) : undefined),
          ) as AnswerValue;
        }
      } else if (q.id in lockedValues) {
        answers[q.id] = lockedValues[q.id];
      } else if (initialValues[q.id] !== undefined) {
        answers[q.id] = initialValues[q.id];
      } else {
        answers[q.id] = fillDefaults ? defaultFor(q) : undefined;
      }
    }
    return answers;
  }, [doc, lockedValues, initialValues, fillDefaults]);

  const [answers, setAnswers] = useState<FormAnswers>(initialAnswers);

  const [seen, setSeen] = useState(doc);
  if (seen !== doc) {
    setSeen(doc);
    setAnswers(initialAnswers);
  }

  return (
    <Stack
      component="form"
      gap="md"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(answers);
      }}
    >
      <div>
        <Title order={3}>{doc.title}</Title>
        {doc.description && (
          <Text c="dimmed" size="sm">
            {doc.description}
          </Text>
        )}
      </div>

      {doc.questions.map((q) =>
        q.type === "repeatable-group" ? (
          <RepeatableGroupField
            key={q.id}
            question={q}
            values={answers}
            disabled={readOnly}
            onChange={(childId, idx, v) =>
              setAnswers((prev) => {
                const existing = prev[childId];
                const arr: RepeatableColumn = Array.isArray(existing)
                  ? [...(existing as RepeatableColumn)]
                  : [];
                arr[idx] = (v ?? null) as RepeatableColumn[number];
                return { ...prev, [childId]: arr as AnswerValue };
              })
            }
          />
        ) : (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[q.id]}
            disabled={readOnly || q.id in lockedValues}
            onChange={(value) =>
              setAnswers((prev) => ({ ...prev, [q.id]: value }))
            }
          />
        ),
      )}

      {!readOnly && (
        <Group mt="sm">
          {onSaveDraft && (
            <Button
              type="button"
              variant="light"
              onClick={() => onSaveDraft(answers)}
            >
              {saveDraftLabel}
            </Button>
          )}
          <Button type="submit">{submitLabel}</Button>
        </Group>
      )}
    </Stack>
  );
}

export interface QuestionFieldProps {
  question: Question;
  value: AnswerValue;
  disabled?: boolean;
  onChange: (value: AnswerValue) => void;
}

function asString(value: AnswerValue): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: AnswerValue): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? (value as string[])
    : [];
}

function asNumber(value: AnswerValue, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

export function QuestionField({
  question,
  value,
  disabled,
  onChange,
}: QuestionFieldProps) {
  switch (question.type) {
    case "string":
      return (
        <TextInput
          label={question.label}
          description={question.description}
          placeholder={question.config?.placeholder}
          required={question.required}
          disabled={disabled}
          minLength={question.config?.minLength}
          maxLength={question.config?.maxLength}
          value={asString(value)}
          onChange={(event) => {
            const next = event.currentTarget.value;
            onChange(next === "" ? undefined : next);
          }}
        />
      );

    case "textarea":
      return (
        <Textarea
          label={question.label}
          description={question.description}
          placeholder={question.config?.placeholder}
          required={question.required}
          disabled={disabled}
          minLength={question.config?.minLength}
          maxLength={question.config?.maxLength}
          autosize
          minRows={question.config?.minRows ?? 2}
          maxRows={question.config?.maxRows ?? 8}
          value={asString(value)}
          onChange={(event) => {
            const next = event.currentTarget.value;
            onChange(next === "" ? undefined : next);
          }}
        />
      );

    case "password":
      return (
        <PasswordInput
          label={question.label}
          description={question.description}
          placeholder={question.config?.placeholder}
          required={question.required}
          disabled={disabled}
          minLength={question.config?.minLength}
          maxLength={question.config?.maxLength}
          value={asString(value)}
          onChange={(event) => {
            const next = event.currentTarget.value;
            onChange(next === "" ? undefined : next);
          }}
        />
      );

    case "number":
      return (
        <NumberInput
          label={question.label}
          description={question.description}
          placeholder={question.config?.placeholder}
          required={question.required}
          disabled={disabled}
          min={question.config?.min}
          max={question.config?.max}
          step={question.config?.step}
          value={typeof value === "number" ? value : ""}
          onChange={(next) => {
            if (next === "" || next === null || next === undefined) {
              onChange(undefined);
            } else {
              onChange(typeof next === "number" ? next : Number(next));
            }
          }}
        />
      );

    case "select-string":
      return (
        <Select
          label={question.label}
          description={question.description}
          placeholder={question.config.placeholder}
          required={question.required}
          disabled={disabled}
          data={question.config.options.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          value={typeof value === "string" ? value : null}
          onChange={(next) => onChange(next ?? undefined)}
        />
      );

    case "select-number":
      return (
        <Select
          label={question.label}
          description={question.description}
          placeholder={question.config.placeholder}
          required={question.required}
          disabled={disabled}
          data={question.config.options.map((o) => ({
            value: String(o.value),
            label: o.label,
          }))}
          value={typeof value === "number" ? String(value) : null}
          onChange={(next) =>
            onChange(next === null ? undefined : Number(next))
          }
        />
      );

    case "multi-select":
      return (
        <MultiSelect
          label={question.label}
          description={question.description}
          placeholder={question.config.placeholder}
          required={question.required}
          disabled={disabled}
          maxValues={question.config.maxValues}
          data={question.config.options.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          value={asStringArray(value)}
          onChange={(next) => onChange(next.length === 0 ? [] : next)}
        />
      );

    case "radio":
      return (
        <Radio.Group
          label={question.label}
          description={question.description}
          required={question.required}
          value={typeof value === "string" ? value : null}
          onChange={(next) => onChange(next || undefined)}
        >
          <Stack gap="xs" mt="xs">
            {question.config.options.map((o) => (
              <Radio
                key={o.value}
                value={o.value}
                label={o.label}
                disabled={disabled}
              />
            ))}
          </Stack>
        </Radio.Group>
      );

    case "checkbox-group":
      return (
        <Checkbox.Group
          label={question.label}
          description={question.description}
          required={question.required}
          value={asStringArray(value)}
          onChange={(next) => onChange(next)}
        >
          <Stack gap="xs" mt="xs">
            {question.config.options.map((o) => (
              <Checkbox
                key={o.value}
                value={o.value}
                label={o.label}
                disabled={disabled}
              />
            ))}
          </Stack>
        </Checkbox.Group>
      );

    case "boolean":
      return (
        <Switch
          label={question.label}
          description={question.description}
          disabled={disabled}
          checked={value === true}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
      );

    case "segmented":
      return (
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            {question.label}
            {question.required && (
              <Text component="span" c="red" ml={4}>
                *
              </Text>
            )}
          </Text>
          {question.description && (
            <Text size="xs" c="dimmed">
              {question.description}
            </Text>
          )}
          <SegmentedControl
            disabled={disabled}
            data={question.config.options.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            value={asString(value)}
            onChange={(next) => onChange(next || undefined)}
          />
        </Stack>
      );

    case "slider":
      return (
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            {question.label}
            {question.required && (
              <Text component="span" c="red" ml={4}>
                *
              </Text>
            )}
          </Text>
          {question.description && (
            <Text size="xs" c="dimmed">
              {question.description}
            </Text>
          )}
          <Slider
            disabled={disabled}
            min={question.config.min}
            max={question.config.max}
            step={question.config.step}
            marks={question.config.marks}
            value={asNumber(
              value,
              question.config.default ?? question.config.min,
            )}
            onChange={(next) => onChange(next)}
          />
        </Stack>
      );

    case "rating":
      return (
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            {question.label}
            {question.required && (
              <Text component="span" c="red" ml={4}>
                *
              </Text>
            )}
          </Text>
          {question.description && (
            <Text size="xs" c="dimmed">
              {question.description}
            </Text>
          )}
          <Rating
            readOnly={disabled}
            count={question.config?.count ?? 5}
            fractions={question.config?.fractions}
            value={asNumber(value, 0)}
            onChange={(next) => onChange(next === 0 ? undefined : next)}
          />
        </Stack>
      );

    case "color":
      return (
        <ColorInput
          label={question.label}
          description={question.description}
          placeholder={question.config?.placeholder}
          required={question.required}
          disabled={disabled}
          swatches={question.config?.swatches}
          format={question.config?.format ?? "hex"}
          value={asString(value)}
          onChange={(next) => onChange(next || undefined)}
        />
      );

    case "date":
      return (
        <TextInput
          type="date"
          label={question.label}
          description={question.description}
          required={question.required}
          disabled={disabled}
          min={question.config?.min}
          max={question.config?.max}
          value={asString(value)}
          onChange={(event) => {
            const next = event.currentTarget.value;
            onChange(next === "" ? undefined : next);
          }}
        />
      );

    case "time":
      return (
        <TextInput
          type="time"
          label={question.label}
          description={question.description}
          required={question.required}
          disabled={disabled}
          step={question.config?.step}
          value={asString(value)}
          onChange={(event) => {
            const next = event.currentTarget.value;
            onChange(next === "" ? undefined : next);
          }}
        />
      );

    case "datetime":
      return (
        <TextInput
          type="datetime-local"
          label={question.label}
          description={question.description}
          required={question.required}
          disabled={disabled}
          value={asString(value)}
          onChange={(event) => {
            const next = event.currentTarget.value;
            onChange(next === "" ? undefined : next);
          }}
        />
      );

    case "tags":
      return (
        <TagsInput
          label={question.label}
          description={question.description}
          placeholder={question.config?.placeholder}
          required={question.required}
          disabled={disabled}
          maxTags={question.config?.maxTags}
          data={question.config?.suggestions}
          value={asStringArray(value)}
          onChange={(next) => onChange(next)}
        />
      );

    case "repeatable-group":
      return null;
  }
}
