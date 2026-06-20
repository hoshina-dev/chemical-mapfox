"use client";

import {
  type AnswerValue,
  type FormAnswers,
  type Question,
  QuestionField,
  RepeatableGroupField,
  type RepeatableGroupQuestion,
} from "@repo/forms";
import { Code, Paper, Stack, Text } from "@mantine/core";
import { useState } from "react";

type RepeatableColumn = Exclude<Extract<AnswerValue, unknown[]>, string[]>;

function defaultFor(q: Question): AnswerValue {
  if (q.type === "repeatable-group") {
    return undefined;
  }
  if (q.config && "default" in q.config && q.config.default !== undefined) {
    return q.config.default as AnswerValue;
  }
  switch (q.type) {
    case "boolean":
      return false;
    case "multi-select":
    case "checkbox-group":
    case "tags":
      return [];
    default:
      return undefined;
  }
}

function initialGroupValues(question: RepeatableGroupQuestion): FormAnswers {
  const values: FormAnswers = {};
  for (const child of question.config.questions) {
    const defaultVal = defaultFor(child);
    values[child.id] = Array.from(
      { length: question.config.count },
      () => defaultVal,
    ) as AnswerValue;
  }
  return values;
}

interface GalleryValueDisplayProps {
  question: Question;
}

export function GalleryValueDisplay({ question }: GalleryValueDisplayProps) {
  if (question.type === "repeatable-group") {
    return <GroupValueDisplay question={question} />;
  }
  return <LeafValueDisplay question={question} />;
}

function LeafValueDisplay({
  question,
}: {
  question: Exclude<Question, RepeatableGroupQuestion>;
}) {
  const [value, setValue] = useState<AnswerValue>(defaultFor(question));

  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <QuestionField question={question} value={value} onChange={setValue} />
      </Paper>
      <div>
        <Text size="sm" c="dimmed" mb={4}>
          Current value
        </Text>
        <Code block>{JSON.stringify(value, null, 2)}</Code>
      </div>
    </Stack>
  );
}

function GroupValueDisplay({
  question,
}: {
  question: RepeatableGroupQuestion;
}) {
  const [groupValues, setGroupValues] = useState<FormAnswers>(() =>
    initialGroupValues(question),
  );

  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <RepeatableGroupField
          question={question}
          values={groupValues}
          onChange={(childId, index, value) =>
            setGroupValues((prev) => {
              const existing = prev[childId];
              const arr: RepeatableColumn = Array.isArray(existing)
                ? [...(existing as RepeatableColumn)]
                : [];
              arr[index] = (value ?? null) as RepeatableColumn[number];
              return { ...prev, [childId]: arr as AnswerValue };
            })
          }
        />
      </Paper>
      <div>
        <Text size="sm" c="dimmed" mb={4}>
          Current value
        </Text>
        <Code block>{JSON.stringify(groupValues, null, 2)}</Code>
      </div>
    </Stack>
  );
}
