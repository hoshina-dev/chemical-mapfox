"use client";

import {
  Badge,
  Box,
  Group,
  Menu,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useTransition } from "react";

import { logout } from "@/app/actions/auth";
import { UserAvatar } from "@/components/UserAvatar";
import classes from "@/components/nav/nav.module.css";
import type { UserOrganization } from "@/lib/auth/organizations";
import type { CustApiRole } from "@/lib/auth/definitions";
import { roleLabel } from "@/lib/auth/definitions";

export interface UserMenuProps {
  name: string;
  email?: string;
  avatarUrl?: string;
  role?: CustApiRole;
  organizations: UserOrganization[];
  /** "dark" tunes the trigger colors for the dark admin nav. */
  variant?: "light" | "dark";
}

export function UserMenu({
  name,
  email,
  avatarUrl,
  role,
  organizations,
  variant = "light",
}: UserMenuProps) {
  const [pending, startTransition] = useTransition();
  const dark = variant === "dark";

  return (
    <Menu position="bottom-end" width={260} withinPortal shadow="md">
      <Menu.Target>
        <UnstyledButton
          aria-label="User menu"
          className={`${classes.userMenuTrigger} ${dark ? classes.userMenuTriggerDark : classes.userMenuTriggerLight}`}
        >
          <UserAvatar
            name={name}
            email={email}
            avatarUrl={avatarUrl}
            size={32}
            radius="xl"
          />
          <Text
            size="sm"
            c={dark ? "gray.4" : "dimmed"}
            fw={500}
            className={classes.userMenuName}
          >
            {name}
          </Text>
          <Badge variant="light" color={role === "admin" ? "grape" : "blue"}>
            {roleLabel(role)}
          </Badge>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Box px="sm" py="xs">
          <Group gap="sm" wrap="nowrap">
            <UserAvatar
              name={name}
              email={email}
              avatarUrl={avatarUrl}
              size={40}
              radius="xl"
            />
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} truncate>
                {name}
              </Text>
              {email && (
                <Text size="xs" c="dimmed" truncate>
                  {email}
                </Text>
              )}
            </Stack>
          </Group>
        </Box>

        <Menu.Divider />
        <Menu.Label>Organizations</Menu.Label>
        {organizations.length === 0 ? (
          <Box px="sm" pb="xs">
            <Text size="xs" c="dimmed">
              No organizations yet.
            </Text>
          </Box>
        ) : (
          <Stack gap={2} px="sm" pb="xs">
            {organizations.map((org) => (
              <Group key={org.id} justify="space-between" wrap="nowrap" gap="xs">
                <Text size="sm" truncate>
                  {org.name}
                </Text>
                {org.role && (
                  <Badge size="xs" variant="light" color="gray">
                    {org.role}
                  </Badge>
                )}
              </Group>
            ))}
          </Stack>
        )}

        <Menu.Divider />
        <Menu.Item
          color="red"
          disabled={pending}
          onClick={() => startTransition(() => void logout())}
        >
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
