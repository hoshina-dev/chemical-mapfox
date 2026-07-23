"use client";

import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { useTranslations } from "next-intl";

import { type FormDraft, makeQuestion } from "@/lib/builder";

import { CollapsiblePanel } from "./CollapsiblePanel";
import { textProps } from "./fieldProps";
import { QuestionEditor } from "./QuestionEditor";

interface SectionEditorProps {
  form: UseFormReturnType<FormDraft>;
  path: "clientForm" | "labForm";
}

export function SectionEditor({ form, path }: SectionEditorProps) {
  const t = useTranslations("builder");
  const section = form.values[path];
  const questionsPath = `${path}.questions`;

  const count = section.questions.length;

  return (
    <CollapsiblePanel
      title={path === "clientForm" ? t("section.clientForm") : t("section.labForm")}
      badge={t("section.questionCount", { count })}
    >
      <TextInput
        label={t("section.name")}
        required
        {...textProps(form, `${path}.name`)}
      />
      <TextInput
        label={t("section.description")}
        {...textProps(form, `${path}.description`)}
      />

      <Stack gap="md">
        {count === 0 && (
          <Text size="sm" c="dimmed">
            {t("section.noQuestions")}
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
          {t("section.addQuestion")}
        </Button>
      </Group>
    </CollapsiblePanel>
  );
}
