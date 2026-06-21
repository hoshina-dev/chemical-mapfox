"use client";

import { Alert, Button, Card, Group, Stack } from "@mantine/core";
import type { FormAnswers, FormDoc } from "@repo/forms";
import { useMemo, useState, useTransition } from "react";

import { submitExperimentAction } from "@/app/actions/experiment";
import type { SessionUser } from "@/lib/auth/definitions";
import type { PresenceEntry } from "@/lib/collab/events";

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

  const submit = () =>
    startTransition(async () => {
      const res = await submitExperimentAction(contextId);
      setResult(res.success ? { ok: true } : { error: res.error });
    });

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
          onFocusField={focusField}
          onBlurField={blurField}
          onEdit={edit}
        />
      </Card>

      {result?.error && (
        <Alert color="red" variant="light" title="Submit failed">
          {result.error}
        </Alert>
      )}
      {result?.ok && (
        <Alert color="teal" variant="light" title="Submitted">
          Experiment submitted to the final stage.
        </Alert>
      )}

      <Group justify="flex-end">
        <Button onClick={submit} loading={pending} disabled={!canSubmit}>
          Submit to final stage
        </Button>
      </Group>
    </Stack>
  );
}
