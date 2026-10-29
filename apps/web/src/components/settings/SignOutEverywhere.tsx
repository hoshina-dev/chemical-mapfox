"use client";

import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { signOutEverywhere } from "@/app/actions/account";

export function SignOutEverywhere() {
  const t = useTranslations("settings.sessions");
  const [pending, startTransition] = useTransition();

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed">{t("subtitle")}</Text>
      </Stack>
      <Group>
        <Button
          color="red"
          variant="light"
          loading={pending}
          onClick={() => startTransition(() => signOutEverywhere())}
        >
          {t("submit")}
        </Button>
      </Group>
    </Stack>
  );
}
