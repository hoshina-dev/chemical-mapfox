"use client";

import { Avatar, Group, Text, Tooltip } from "@mantine/core";

import type { PresenceEntry } from "@/lib/collab/events";

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

/** Avatars of the staff currently in edit mode; hover shows the full name. */
export function PresenceBar({ editors }: { editors: PresenceEntry[] }) {
  if (editors.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No one else is editing right now.
      </Text>
    );
  }

  return (
    <Group gap="xs" align="center">
      <Text size="sm" c="dimmed">
        Editing now:
      </Text>
      <Avatar.Group>
        {editors.map((editor) => (
          <Tooltip key={editor.userId} label={editor.name} withArrow>
            <Avatar
              src={editor.avatarUrl ?? undefined}
              alt={editor.name}
              color={editor.color}
              radius="xl"
              style={{
                border: `2px solid var(--mantine-color-${editor.color}-6)`,
              }}
            >
              {initials(editor.name)}
            </Avatar>
          </Tooltip>
        ))}
      </Avatar.Group>
    </Group>
  );
}
