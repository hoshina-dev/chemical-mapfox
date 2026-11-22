"use client";

import {
  Accordion,
  Alert,
  Box,
  Button,
  Group,
  List,
  LoadingOverlay,
  Stack,
  Text,
} from "@mantine/core";
import {
  type AnswerIssue,
  type AnswerValue,
  type FormAnswers,
  type FormDoc,
  initialAnswersFor,
  QuestionField,
  type Question,
  RepeatableGroupField,
  validateAnswers,
} from "@repo/forms";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { requestExperimentAction } from "@/app/actions/experiment-request";
import { myExperimentDetailPath } from "@/lib/experiment/routes";
import { formatAnswerIssue } from "@/lib/forms/answerIssues";

/** One repeatable-group child's answers, one entry per repetition. */
type RepeatableColumn = Exclude<Extract<AnswerValue, unknown[]>, string[]>;

export interface RequestMethod {
  id: string;
  title: string;
  description?: string;
  clientForm: FormDoc;
}

interface RequestExperimentFormProps {
  /** The method the request started from (always requested). */
  templateId: string;
  /** Other methods ticked in the catalogue (unknown ids are ignored). */
  initialMethods?: string[];
  /** Every method of the sample type. */
  methods: RequestMethod[];
  canRequest: boolean;
}

/**
 * One request = one physical sample with the methods ticked in the catalogue:
 * a short list of them, then one section per method that needs answers from the
 * client, and one submit button. Each method keeps its own answers, also for a
 * question id another method asks too.
 */
export function RequestExperimentForm({
  templateId,
  initialMethods = [],
  methods,
  canRequest,
}: RequestExperimentFormProps) {
  const t = useTranslations("experiment.request.form");
  const tIssue = useTranslations("forms.validation");
  const router = useRouter();

  const chosen = useMemo(
    () => [
      ...methods.filter((m) => m.id === templateId),
      ...methods.filter((m) => m.id !== templateId && initialMethods.includes(m.id)),
    ],
    [methods, templateId, initialMethods],
  );
  const sections = useMemo(
    () =>
      chosen
        .map((m) => ({ method: m, questions: m.clientForm.questions }))
        .filter((s) => s.questions.length > 0),
    [chosen],
  );

  // Answers per method id, so methods asking the same question id keep their own.
  const [answers, setAnswers] = useState<Record<string, FormAnswers>>(() =>
    Object.fromEntries(chosen.map((m) => [m.id, initialAnswersFor(m.clientForm.questions)])),
  );
  const [issues, setIssues] = useState<Record<string, AnswerIssue[]>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per form: if a response is lost and the client submits again, experiment-manager
  // returns the ticket the first attempt made instead of creating a second one.
  const [requestKey] = useState(() => crypto.randomUUID());

  const allIssues = sections.flatMap(({ method }) =>
    (issues[method.id] ?? []).map((issue) => ({ method, issue })),
  );
  const fieldErrorsFor = (methodId: string) => {
    const errors: Record<string, string> = {};
    for (const issue of issues[methodId] ?? []) {
      errors[issue.path] ??= formatAnswerIssue(tIssue, issue);
    }
    return errors;
  };

  const edit = (methodId: string, update: (prev: FormAnswers) => FormAnswers) => {
    setAnswers((prev) => ({ ...prev, [methodId]: update(prev[methodId] ?? {}) }));
    if (allIssues.length > 0) setIssues({});
  };
  const done = (methodId: string, questions: Question[]) =>
    validateAnswers(questions, answers[methodId] ?? {}).length === 0;

  async function submit() {
    if (pending || !canRequest) return;
    const found = Object.fromEntries(
      sections.map(({ method, questions }) => [
        method.id,
        validateAnswers(questions, answers[method.id] ?? {}),
      ]),
    );
    setIssues(found);
    if (Object.values(found).some((list) => list.length > 0)) return;
    setPending(true);
    setError(null);
    const result = await requestExperimentAction({
      templateId,
      templateIds: chosen.map((m) => m.id),
      values: answers,
      requestKey,
    });
    if (!result.success) {
      setError(result.error);
      setPending(false);
      return;
    }
    // Keep `pending` set so the form stays blocked while navigating away.
    router.push(myExperimentDetailPath(result.data.contextId));
  }

  return (
    <Box pos="relative">
      <LoadingOverlay visible={pending} zIndex={1000} overlayProps={{ blur: 1 }} />
      <Stack gap="lg">
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            {t("requestedLabel", { count: chosen.length })}
          </Text>
          <List size="sm" spacing={2}>
            {chosen.map((m) => (
              <List.Item key={m.id}>{m.title}</List.Item>
            ))}
          </List>
        </Stack>

        {sections.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("noIntake")}
          </Text>
        ) : (
          <Accordion
            multiple
            variant="separated"
            radius="md"
            defaultValue={sections.map((s) => s.method.id)}
          >
            {sections.map(({ method, questions }) => {
              const complete = done(method.id, questions);
              const values = answers[method.id] ?? {};
              const fieldErrors = fieldErrorsFor(method.id);
              return (
                <Accordion.Item
                  key={method.id}
                  value={method.id}
                  style={{
                    borderColor: complete
                      ? undefined
                      : "var(--mantine-color-red-filled)",
                  }}
                >
                  <Accordion.Control>
                    <Text fw={500}>{method.title}</Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <fieldset
                      disabled={pending || !canRequest}
                      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                    >
                      <Stack gap="sm">
                        {questions.map((q) =>
                          q.type === "repeatable-group" ? (
                            <RepeatableGroupField
                              key={q.id}
                              question={q}
                              values={values}
                              errors={fieldErrors}
                              onChange={(childId, i, value) =>
                                edit(method.id, (prev) => {
                                  const column = Array.isArray(prev[childId])
                                    ? [...(prev[childId] as RepeatableColumn)]
                                    : [];
                                  column[i] = (value ?? null) as RepeatableColumn[number];
                                  return { ...prev, [childId]: column as AnswerValue };
                                })
                              }
                            />
                          ) : (
                            <QuestionField
                              key={q.id}
                              question={q}
                              value={values[q.id]}
                              error={fieldErrors[q.id]}
                              onChange={(value) =>
                                edit(method.id, (prev) => ({ ...prev, [q.id]: value }))
                              }
                            />
                          ),
                        )}
                      </Stack>
                    </fieldset>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion>
        )}

        {allIssues.length > 0 && (
          <Alert
            color="red"
            variant="light"
            title={
              allIssues.every(({ issue }) => issue.code === "required")
                ? t("missingRequired")
                : tIssue("invalidTitle")
            }
          >
            <List size="sm">
              {allIssues.map(({ method, issue }) => (
                <List.Item key={`${method.id}:${issue.path}:${issue.code}`}>
                  {method.title}:{" "}
                  {issue.code === "required" ? issue.label : formatAnswerIssue(tIssue, issue)}
                </List.Item>
              ))}
            </List>
          </Alert>
        )}
        {error && (
          <Alert color="red" variant="light" title={t("errorTitle")} style={{ whiteSpace: "pre-wrap" }}>
            {error}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button onClick={submit} loading={pending} disabled={!canRequest}>
            {t("submit")}
          </Button>
        </Group>
      </Stack>
    </Box>
  );
}
