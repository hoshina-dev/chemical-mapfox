"use client";

import { Avatar, Group, Text, Tooltip } from "@mantine/core";

import { UserAvatar } from "@/components/UserAvatar";
import type { PresenceEntry } from "@/lib/collab/events";

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
            <UserAvatar
              name={editor.name}
              avatarUrl={editor.avatarUrl}
              alt={editor.name}
              color={editor.color}
              radius="xl"
              style={{
                border: `2px solid var(--mantine-color-${editor.color}-6)`,
              }}
            />
          </Tooltip>
        ))}
      </Avatar.Group>
    </Group>
  );
}
