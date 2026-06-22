"use client";

import { Avatar, Box, Stack, Text, Title, Tooltip } from "@mantine/core";
import type { AnswerValue, FormAnswers, FormDoc } from "@repo/forms";
import { QuestionField, RepeatableGroupField } from "@repo/forms";

import type { LockMap, PresenceEntry } from "@/lib/collab/events";

import readable from "../readableFields.module.css";

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

export interface CollaborativeFormRendererProps {
  doc: FormDoc;
  values: FormAnswers;
  /** field (question id) → owning connectionId */
  locks: LockMap;
  /** connectionId → presence entry (for color/name/avatar of lock owners) */
  editorsByConnection: Map<string, PresenceEntry>;
  /** This tab's connection id — a field locked by any *other* connection is read-only. */
  currentConnectionId: string;
  onFocusField: (field: string) => void;
  onBlurField: (field: string) => void;
  onEdit: (field: string, value: AnswerValue) => void;
}

/**
 * A controlled, collaborative rendering of a form. Built from the same
 * `QuestionField` / `RepeatableGroupField` primitives the shared `FormRenderer`
 * uses, so every question type is supported without duplication. A field locked
 * by another editor is disabled and highlighted in that editor's color, with
 * their avatar pinned to the corner; its displayed value still updates live as
 * remote `edit` events arrive via the parent's `values`.
 */
export function CollaborativeFormRenderer({
  doc,
  values,
  locks,
  editorsByConnection,
  currentConnectionId,
  onFocusField,
  onBlurField,
  onEdit,
}: CollaborativeFormRendererProps) {
  return (
    <Stack component="form" gap="md" onSubmit={(e) => e.preventDefault()}>
      <div>
        <Title order={3}>{doc.name}</Title>
        {doc.description && (
          <Text c="dimmed" size="sm">
            {doc.description}
          </Text>
        )}
      </div>

      {doc.questions.map((q) => {
        const owner = locks[q.id];
        // Only honor a lock whose owner is still present. A lock left behind by
        // a crashed/closed session (presence already gone, unlock never received)
        // is ignored so the field never shows "locked, nobody editing".
        const editor =
          owner && owner !== currentConnectionId
            ? editorsByConnection.get(owner)
            : undefined;
        const lockedByOther = editor !== undefined;
        const color = editor?.color;

        const field =
          q.type === "repeatable-group" ? (
            <RepeatableGroupField
              question={q}
              values={values}
              disabled={lockedByOther}
              onChange={(childId, index, value) => {
                const existing = values[childId];
                const arr: AnswerValue[] = Array.isArray(existing)
                  ? [...(existing as AnswerValue[])]
                  : [];
                arr[index] = (value ?? null) as AnswerValue;
                onEdit(childId, arr as unknown as AnswerValue);
              }}
            />
          ) : (
            <QuestionField
              question={q}
              value={values[q.id]}
              disabled={lockedByOther}
              onChange={(value) => onEdit(q.id, value)}
            />
          );

        return (
          <Box
            key={q.id}
            data-field={q.id}
            data-locked={lockedByOther || undefined}
            onFocusCapture={() => onFocusField(q.id)}
            onBlurCapture={() => onBlurField(q.id)}
            style={{
              position: "relative",
              borderLeft: `3px solid ${
                color ? `var(--mantine-color-${color}-6)` : "transparent"
              }`,
              paddingLeft: "var(--mantine-spacing-sm)",
              transition: "border-color 120ms ease",
            }}
          >
            {/* Editor "pin": absolutely positioned so it never shifts the field.
                It hangs left into the card's padding, anchored to the colored
                edge, with a ring so it reads cleanly over the border. */}
            {editor && (
              <Tooltip label={editor.name} withArrow position="left">
                <Avatar
                  src={editor.avatarUrl ?? undefined}
                  alt={editor.name}
                  color={color}
                  size="sm"
                  radius="xl"
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: 0,
                    transform: "translate(-50%, -50%)",
                    border: `2px solid var(--mantine-color-${color}-6)`,
                    boxShadow: "0 0 0 2px var(--mantine-color-body)",
                    zIndex: 2,
                  }}
                >
                  {initials(editor.name)}
                </Avatar>
              </Tooltip>
            )}

            {/* When locked by someone else the field is `disabled` (non-interactive,
                accessible, uniform across field types) but wrapped in the shared
                `readable` style so its value stays full-contrast and legible while
                it updates live — same treatment as the client read-only view. A
                subtle theme-aware tint marks it as claimed. */}
            {lockedByOther ? (
              <div
                className={readable.readable}
                style={
                  color
                    ? {
                        backgroundColor: `var(--mantine-color-${color}-light)`,
                        borderRadius: "var(--mantine-radius-sm)",
                      }
                    : undefined
                }
              >
                {field}
              </div>
            ) : (
              field
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
