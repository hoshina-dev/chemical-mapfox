"use client";

import {
  type Question,
  Question as QuestionSchema,
  type QuestionType,
} from "@repo/forms";
import {
  Alert,
  Button,
  Code,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useState } from "react";

import { GalleryValueDisplay } from "@/components/docs/GalleryValueDisplay";

interface GalleryQuestionWorkbenchProps {
  example: Question;
  expectedType: QuestionType;
}

interface ValidationResult {
  question?: Question;
  error?: string;
}

export function GalleryQuestionWorkbench({
  example,
  expectedType,
}: GalleryQuestionWorkbenchProps) {
  const initialJson = formatJson(example);
  const [json, setJson] = useState(initialJson);
  const [question, setQuestion] = useState<Question>(example);
  const [error, setError] = useState<string | undefined>();

  const updateJson = (nextJson: string) => {
    setJson(nextJson);

    const result = parseQuestion(nextJson, expectedType);
    setError(result.error);

    if (result.question) {
      setQuestion(result.question);
    }
  };

  const resetJson = () => {
    setJson(initialJson);
    setQuestion(example);
    setError(undefined);
  };

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Title order={4}>Customize JSON</Title>
            <Button variant="light" size="xs" onClick={resetJson}>
              Reset
            </Button>
          </Group>
          <Textarea
            aria-label="Question JSON"
            autosize
            minRows={18}
            maxRows={32}
            spellCheck={false}
            styles={{
              input: {
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "var(--mantine-font-size-sm)",
                lineHeight: 1.45,
              },
            }}
            value={json}
            onChange={(event) => updateJson(event.currentTarget.value)}
          />
          {error ? (
            <Alert color="red" variant="light">
              <Text size="sm">{error}</Text>
            </Alert>
          ) : (
            <Text size="sm" c="dimmed">
              Valid JSON. The preview updates as you edit the field settings.
            </Text>
          )}
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Title order={4}>Live preview</Title>
          <GalleryValueDisplay question={question} />
          <div>
            <Text size="sm" c="dimmed" mb={4}>
              Active JSON
            </Text>
            <Code block>{formatJson(question)}</Code>
          </div>
        </Stack>
      </Paper>
    </SimpleGrid>
  );
}

function parseQuestion(
  source: string,
  expectedType: QuestionType,
): ValidationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid JSON.",
    };
  }

  const result = QuestionSchema.safeParse(parsed);

  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "root";
    return {
      error: issue ? `${path}: ${issue.message}` : "Invalid question JSON.",
    };
  }

  if (result.data.type !== expectedType) {
    return {
      error: `type must remain "${expectedType}" on this docs page.`,
    };
  }

  return { question: result.data };
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
