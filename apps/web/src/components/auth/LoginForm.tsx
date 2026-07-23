"use client";

import {
  Alert,
  Button,
  PasswordInput,
  Stack,
  TextInput,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { login } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const t = useTranslations("auth.login");

  return (
    <form action={action}>
      <Stack gap="md">
        <TextInput
          label={t("email")}
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state?.errors?.email?.[0]}
        />
        <PasswordInput
          label={t("password")}
          name="password"
          autoComplete="current-password"
          required
          error={state?.errors?.password?.[0]}
        />

        {state?.message && (
          <Alert color="red" variant="light">
            {state.message}
          </Alert>
        )}

        <Button type="submit" loading={pending}>
          {t("submit")}
        </Button>
      </Stack>
    </form>
  );
}
