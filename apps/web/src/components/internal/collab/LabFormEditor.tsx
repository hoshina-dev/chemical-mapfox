"use client";

import { Alert, Button, Card, Group, List, Stack } from "@mantine/core";
import type { AnswerIssue, FormAnswers, FormDoc } from "@repo/forms";
import { validateAnswers } from "@repo/forms";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";

import { submitExperimentAction } from "@/app/actions/experiment";
import type { SessionUser } from "@/lib/auth/definitions";
import type { PresenceEntry } from "@/lib/collab/events";
import { formatAnswerIssue } from "@/lib/forms/answerIssues";

import { CollaborativeFormRenderer } from "./CollaborativeFormRenderer";
import { PresenceBar } from "./PresenceBar";
import { useCollab } from "./useCollab";

export interface LabFormEditorProps {
  contextId: string;
  doc: FormDoc;
  initialValues: FormAnswers;
  currentUser: SessionUser;
  /** Submit is only valid from the EXPERIMENTING status. */
  canSubmit: boolean;
}

/**
 * Collaborative editor for the lab form: wires the live `useCollab` session to
 * the presence bar + the controlled renderer, and offers a Submit-to-final-stage
 * action. Edits autosave to experiment-manager via the collab event stream.
 */
export function LabFormEditor({
  contextId,
  doc,
  initialValues,
  currentUser,
  canSubmit,
}: LabFormEditorProps) {
  const t = useTranslations("staff.collab");
  const tIssue = useTranslations("forms.validation");
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
      const res = await submitExperimentAction(contextId);
      setResult(res.success ? { ok: true } : { error: res.error });
    });
  };

  return (
    <Stack gap="md">
      <PresenceBar editors={others} />

      <Card withBorder radius="md" padding="lg">
        <CollaborativeFormRenderer
          doc={doc}
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
        <Button onClick={submit} loading={pending} disabled={!canSubmit}>
          {t("submitToFinalStage")}
        </Button>
      </Group>
    </Stack>
  );
}
