"use client";

import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";

import { type FormDraft, makeQuestion } from "@/lib/builder";

import { CollapsiblePanel } from "./CollapsiblePanel";
import { textProps } from "./fieldProps";
import { QuestionEditor } from "./QuestionEditor";

interface SectionEditorProps {
  form: UseFormReturnType<FormDraft>;
  path: "clientForm" | "labForm";
}

export function SectionEditor({ form, path }: SectionEditorProps) {
  const section = form.values[path];
  const questionsPath = `${path}.questions`;

  const count = section.questions.length;

  return (
    <CollapsiblePanel
      title={path === "clientForm" ? "Client form" : "Lab form"}
      badge={`${count} question${count === 1 ? "" : "s"}`}
    >
      <TextInput
        label="Section name"
        required
        {...textProps(form, `${path}.name`)}
      />
      <TextInput
        label="Section description"
        {...textProps(form, `${path}.description`)}
      />

      <Stack gap="md">
        {count === 0 && (
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
            total={count}
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
          onClick={() => form.insertListItem(questionsPath, makeQuestion("string"))}
        >
          Add question
        </Button>
      </Group>
    </CollapsiblePanel>
  );
}
