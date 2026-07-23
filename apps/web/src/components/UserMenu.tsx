"use client";

import {
  Anchor,
  Badge,
  Box,
  Group,
  Menu,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { logout } from "@/app/actions/auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { UserAvatar } from "@/components/UserAvatar";
import classes from "@/components/nav/nav.module.css";
import type { UserOrganization } from "@/lib/auth/organizations";
import type { CustApiRole } from "@/lib/auth/definitions";
import { organizationPageUrl } from "@/lib/organizationPortal/url";

export interface UserMenuProps {
  name: string;
  email?: string;
  avatarUrl?: string;
  role?: CustApiRole;
  organizations: UserOrganization[];
  organizationPortalUrl: string;
  /** Client settings page; omit for staff menus. */
  settingsHref?: string;
  /** "dark" tunes the trigger colors for the dark admin nav. */
  variant?: "light" | "dark";
}

export function UserMenu({
  name,
  email,
  avatarUrl,
  role,
  organizations,
  organizationPortalUrl,
  settingsHref,
  variant = "light",
}: UserMenuProps) {
  const [pending, startTransition] = useTransition();
  const dark = variant === "dark";
  const t = useTranslations("common");
  const roleText = role === "admin" ? t("roles.labStaff") : t("roles.client");

  return (
    <Menu position="bottom-end" width={260} withinPortal shadow="md">
      <Menu.Target>
        <UnstyledButton
          aria-label={t("userMenu.ariaLabel")}
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
            {roleText}
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
        {organizations.length === 0 ? (
          <>
            <Menu.Label>{t("userMenu.organizations")}</Menu.Label>
            <Box px="sm" pb="xs">
              <Text size="xs" c="dimmed">
                {t("userMenu.noOrganizations")}
              </Text>
            </Box>
          </>
        ) : (
          <Box pb="xs">
            <Group wrap="nowrap" align="center" gap="xs" px="sm" py={6}>
              <Text size="xs" fw={500} c="dimmed">
                {t("userMenu.organizations")}
              </Text>
              {organizations.length === 1 && organizations[0]?.role && (
                <Badge
                  size="xs"
                  variant="light"
                  color="gray"
                  style={{ flexShrink: 0 }}
                >
                  {organizations[0]?.role}
                </Badge>
              )}
            </Group>
            <Stack gap={6} px="sm">
              {organizations.map((org) => (
                <Group
                  key={org.id}
                  justify="space-between"
                  align="flex-start"
                  wrap="nowrap"
                  gap="xs"
                >
                  <Anchor
                    href={organizationPageUrl(organizationPortalUrl, org.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    {org.name}
                  </Anchor>
                  {organizations.length > 1 && org.role && (
                    <Badge
                      size="xs"
                      variant="light"
                      color="gray"
                      style={{ flexShrink: 0 }}
                    >
                      {org.role}
                    </Badge>
                  )}
                </Group>
              ))}
            </Stack>
          </Box>
        )}

        {settingsHref && (
          <>
            <Menu.Divider />
            <Menu.Item component="a" href={settingsHref}>
              {t("userMenu.settings")}
            </Menu.Item>
          </>
        )}

        <Menu.Divider />
        <Box px="sm" py="xs">
          <LanguageSwitcher size="xs" />
        </Box>
        <Menu.Divider />
        <Menu.Item
          color="red"
          disabled={pending}
          onClick={() => startTransition(() => void logout())}
        >
          {t("userMenu.logout")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
