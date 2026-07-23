"use client";

import {
  Alert,
  Badge,
  Button,
  Group,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { saveNotificationPreferencesAction } from "@/app/actions/notification-preferences";
import { statusTranslationKey } from "@/lib/ticketing/statusI18n";
import type { StageNotificationPreference } from "@/lib/ticketing/notification-preferences";

function stageLabel(
  stage: string,
  tStatus: (key: string) => string,
): string {
  const key = statusTranslationKey(stage);
  if (key) return tStatus(key);
  return stage
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function NotificationPreferencesForm({
  initialPreferences,
}: {
  initialPreferences: StageNotificationPreference[];
}) {
  const t = useTranslations("settings.notifications");
  const tStatus = useTranslations("status");
  const tCommon = useTranslations("common");
  const [preferences, setPreferences] = useState(initialPreferences);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggleStage(stage: string, emailEnabled: boolean) {
    setSaved(false);
    setError(null);
    setPreferences((prev) =>
      prev.map((p) => (p.stage === stage ? { ...p, emailEnabled } : p)),
    );
  }

  function onSave() {
    startTransition(async () => {
      setError(null);
      setSaved(false);
      const result = await saveNotificationPreferencesAction(preferences);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setPreferences(result.preferences);
      setSaved(true);
    });
  }

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed">{t("subtitle")}</Text>
      </Stack>

      {error && (
        <Alert color="red" variant="light" title={tCommon("error")}>
          {error}
        </Alert>
      )}

      <Stack gap="md">
        {preferences.map((pref) => (
          <Switch
            key={pref.stage}
            checked={pref.emailEnabled}
            onChange={(event) =>
              toggleStage(pref.stage, event.currentTarget.checked)
            }
            label={stageLabel(pref.stage, tStatus)}
            description={t("emailForStage", {
              stage: stageLabel(pref.stage, tStatus),
            })}
            disabled={pending}
          />
        ))}
      </Stack>

      <Group gap="sm" align="center">
        <Button onClick={onSave} loading={pending}>
          {tCommon("save")}
        </Button>
        {saved && !pending && (
          <Badge color="green" variant="light">
            {tCommon("saved")}
          </Badge>
        )}
      </Group>
    </Stack>
  );
}
