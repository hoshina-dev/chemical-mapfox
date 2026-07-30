"use client";

import {
  Alert,
  Badge,
  Button,
  Group,
  PasswordInput,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";

import { changePassword } from "@/app/actions/account";

export function ChangePasswordForm() {
  const t = useTranslations("settings.password");
  const tCommon = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string[];
    newPassword?: string[];
    confirmPassword?: string[];
  }>({});
  const [saved, setSaved] = useState(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      setError(null);
      setFieldErrors({});
      setSaved(false);
      const result = await changePassword(formData);
      if (!result.success) {
        setError(result.error ?? null);
        setFieldErrors(result.errors ?? {});
        return;
      }
      formRef.current?.reset();
      setSaved(true);
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit}>
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

        <PasswordInput
          name="currentPassword"
          label={t("currentPassword")}
          required
          autoComplete="current-password"
          error={fieldErrors.currentPassword?.[0]}
          disabled={pending}
        />
        <PasswordInput
          name="newPassword"
          label={t("newPassword")}
          description={t("newPasswordHint")}
          required
          autoComplete="new-password"
          error={fieldErrors.newPassword?.[0]}
          disabled={pending}
        />
        <PasswordInput
          name="confirmPassword"
          label={t("confirmPassword")}
          required
          autoComplete="new-password"
          error={fieldErrors.confirmPassword?.[0]}
          disabled={pending}
        />

        <Group gap="sm" align="center">
          <Button type="submit" loading={pending}>
            {t("submit")}
          </Button>
          {saved && !pending && (
            <Badge color="green" variant="light">
              {t("success")}
            </Badge>
          )}
        </Group>
      </Stack>
    </form>
  );
}
