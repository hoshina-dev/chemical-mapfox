"use client";

import {
  Button,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";

import { type FormDraft, makeQuestion } from "@/lib/builder";

import { textProps } from "./fieldProps";
import { QuestionEditor } from "./QuestionEditor";

interface SectionEditorProps {
  form: UseFormReturnType<FormDraft>;
  path: "clientForm" | "labForm";
}

export function SectionEditor({ form, path }: SectionEditorProps) {
  const section = form.values[path];
  const questionsPath = `${path}.questions`;

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Title order={3}>
          {path === "clientForm" ? "Client form" : "Lab form"}
        </Title>
        <TextInput
          label="Section title"
          required
          {...textProps(form, `${path}.title`)}
        />
        <TextInput
          label="Section description"
          {...textProps(form, `${path}.description`)}
        />

        <Stack gap="md">
          {section.questions.length === 0 && (
            <Text size="sm" c="dimmed">
              No questions yet.
            </Text>
          )}
          {section.questions.map((question, i) => (
            <QuestionEditor
              key={i}
              form={form}
              path={`${questionsPath}.${i}`}
              question={question}
              index={i}
              total={section.questions.length}
              onMoveUp={() =>
                form.reorderListItem(questionsPath, { from: i, to: i - 1 })
              }
              onMoveDown={() =>
                form.reorderListItem(questionsPath, { from: i, to: i + 1 })
              }
              onRemove={() => form.removeListItem(questionsPath, i)}
            />
          ))}
        </Stack>

        <Group>
          <Button
            variant="light"
            onClick={() =>
              form.insertListItem(questionsPath, makeQuestion("string"))
            }
          >
            Add question
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
