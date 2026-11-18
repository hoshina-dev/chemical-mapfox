"use client";

import { Alert, Button, Card, Group, List, Stack } from "@mantine/core";
import type {
  AnswerIssue,
  ExperimentTemplate,
  FormAnswers,
  FormDoc,
} from "@repo/forms";
import { validateAnswers } from "@repo/forms";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  finishWithCalculations,
  useEngineErrorMessage,
} from "@/lib/calculations/calculateExperiment";
import type { SessionUser } from "@/lib/auth/definitions";
import type { PresenceEntry } from "@/lib/collab/events";
import { formatAnswerIssue } from "@/lib/forms/answerIssues";
import { visibleDishCount } from "@/lib/forms/dishRunMessages";

import { CollaborativeFormRenderer } from "./CollaborativeFormRenderer";
import { DishRunPanel } from "./DishRunPanel";
import { PresenceBar } from "./PresenceBar";
import { useCollab } from "./useCollab";
import { useDishRun } from "./useDishRun";

export interface LabFormEditorProps {
  contextId: string;
  doc: FormDoc;
  /**
   * The whole method, needed to evaluate a dish run in the browser: the engine
   * takes a dry-run body, which is both forms plus the formulas.
   */
  template: ExperimentTemplate;
  initialValues: FormAnswers;
  currentUser: SessionUser;
  /** Submit is only valid from the EXPERIMENTING status. */
  canSubmit: boolean;
}

/**
 * Collaborative editor for the lab form: wires the live `useCollab` session to
 * the presence bar + the controlled renderer, and offers a Submit-to-final-stage
 * action. Edits are saved to sample_tracker via the collab event stream.
 */
export function LabFormEditor({
  contextId,
  doc,
  template,
  initialValues,
  currentUser,
  canSubmit,
}: LabFormEditorProps) {
  const t = useTranslations("staff.collab");
  const tIssue = useTranslations("forms.validation");
  const router = useRouter();
  const engineError = useEngineErrorMessage();
  const { values, presence, locks, connectionId, focusField, blurField, edit } =
    useCollab(contextId, initialValues);

  // Resolve a field's lock owner (a connectionId) → editor for color/avatar.
  const editorsByConnection = useMemo(
    () => new Map(presence.map((p) => [p.connectionId, p])),
    [presence],
  );
  // Presence bar shows other *people* — collapse a user's multiple tabs into
  // one avatar, and never show yourself (from any of your own tabs).
  const others = useMemo(() => {
    const byUser = new Map<string, PresenceEntry>();
    for (const p of presence) {
      if (p.userId === currentUser.userId) continue;
      if (!byUser.has(p.userId)) byUser.set(p.userId, p);
    }
    return [...byUser.values()];
  }, [presence, currentUser.userId]);

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; ok?: boolean } | null>(
    null,
  );
  const [issues, setIssues] = useState<AnswerIssue[]>([]);

  // --- Dish runs ------------------------------------------------------------
  // A dish-run method is rendered as its own panel rather than as a generic
  // repeatable group.
  const {
    state: dishRun,
    pending: dishRunPending,
    stale: dishRunStale,
    error: dishRunError,
    check: checkDishes,
  } = useDishRun(template, values, canSubmit);

  const dishes = useMemo(() => {
    const groupId = doc.dishRun?.group;
    if (!groupId) return null;
    const group = doc.questions.find((q) => q.id === groupId);
    return group?.type === "repeatable-group" ? group : null;
  }, [doc]);

  /**
   * The dish group with `count` cut down to the dishes worth showing.
   */
  const visibleDishes = useMemo(() => {
    if (!dishes || !doc.dishRun) return null;
    const max = Math.min(doc.dishRun.maxDishes, dishes.config.count);
    const wanted = dishRun
      ? visibleDishCount(dishRun, max)
      : Math.min(2, max);
    return { ...dishes, config: { ...dishes.config, count: wanted } };
  }, [dishes, doc.dishRun, dishRun]);

  /** Everything except the dish group — the dish group has its own panel. */
  const otherFields = useMemo(
    () =>
      dishes
        ? { ...doc, questions: doc.questions.filter((q) => q.id !== dishes.id) }
        : doc,
    [doc, dishes],
  );

  // A dish run must reach a pair that agrees before the sample can be
  // submitted, and the decision must reflect the current values
  const dishRunBlocks =
    dishRun !== null &&
    dishRun.phase !== "INACTIVE" &&
    (dishRun.phase !== "DONE" || dishRunStale);

  // Live feedback while typing, limited to the constraints a half-entered
  // answer can't legitimately violate (the same set the collab event route
  // enforces) — a field still being filled in shouldn't read as an error.
  const liveIssues = useMemo(
    () => validateAnswers(doc.questions, values, { mode: "live" }),
    [doc.questions, values],
  );

  // Submit-time issues win over the live ones (they're a superset for the
  // fields they cover); first message per field, so each input shows one error.
  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    for (const issue of [...issues, ...liveIssues]) {
      errors[issue.path] ??= formatAnswerIssue(tIssue, issue);
    }
    return errors;
  }, [issues, liveIssues, tIssue]);

  const submit = () => {
    const found = validateAnswers(doc.questions, values);
    setIssues(found);
    if (found.length > 0) return;
    startTransition(async () => {
      // Saves the buffer, calculates in the browser, then finishes (contextId is the room).
      const res = await finishWithCalculations(contextId, engineError);
      setResult(res.success ? { ok: true } : { error: res.error });
      if (res.success) router.refresh();
    });
  };

  return (
    <Stack gap="md">
      <PresenceBar editors={others} />

      {visibleDishes && (
        <Card withBorder radius="md" padding="lg">
          <Stack gap="lg">
            <CollaborativeFormRenderer
              doc={{ ...doc, questions: [visibleDishes] }}
              values={values}
              locks={locks}
              editorsByConnection={editorsByConnection}
              currentConnectionId={connectionId}
              errors={fieldErrors}
              onFocusField={focusField}
              onBlurField={blurField}
              onEdit={(field, value) => {
                if (issues.length > 0) setIssues([]);
                edit(field, value);
              }}
            />
            {dishRunError && (
              <Alert color="red" variant="light" title={t("dishRunEngineFailed")}>
                {dishRunError}
              </Alert>
            )}
            {dishRun && (
              <DishRunPanel
                state={dishRun}
                pending={dishRunPending}
                stale={dishRunStale}
                onCheck={checkDishes}
              />
            )}
          </Stack>
        </Card>
      )}

      {otherFields.questions.length > 0 && (
        <Card withBorder radius="md" padding="lg">
          <CollaborativeFormRenderer
            doc={otherFields}
            values={values}
            locks={locks}
            editorsByConnection={editorsByConnection}
            currentConnectionId={connectionId}
            errors={fieldErrors}
            onFocusField={focusField}
            onBlurField={blurField}
            onEdit={(field, value) => {
              if (issues.length > 0) setIssues([]);
              edit(field, value);
            }}
          />
        </Card>
      )}

      {result?.error && (
        <Alert color="red" variant="light" title={t("submitFailedTitle")}>
          {result.error}
        </Alert>
      )}
      {result?.ok && (
        <Alert color="teal" variant="light" title={t("submittedTitle")}>
          {t("submittedBody")}
        </Alert>
      )}
      {issues.length > 0 && (
        <Alert
          color="red"
          variant="light"
          title={
            issues.every((issue) => issue.code === "required")
              ? t("missingRequiredTitle")
              : tIssue("invalidTitle")
          }
        >
          <List size="sm">
            {issues.map((issue) => (
              <List.Item key={`${issue.path}:${issue.code}`}>
                {issue.code === "required"
                  ? issue.label
                  : formatAnswerIssue(tIssue, issue)}
              </List.Item>
            ))}
          </List>
        </Alert>
      )}

      <Group justify="flex-end">
        <Button
          onClick={submit}
          loading={pending}
          disabled={!canSubmit || dishRunBlocks}
        >
          {t("submitToFinalStage")}
        </Button>
      </Group>
    </Stack>
  );
}
