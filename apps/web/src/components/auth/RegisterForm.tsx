"use client";

import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  PasswordInput,
  Stack,
  TextInput,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { register } from "@/app/actions/auth";
import { BRAND } from "@/lib/brand";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);
  const t = useTranslations("auth.register");

  return (
    <form action={action}>
      <Stack gap="md">
        <TextInput
          label={t("name")}
          name="name"
          autoComplete="name"
          required
          error={state?.errors?.name?.[0]}
        />
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
          autoComplete="new-password"
          required
          error={state?.errors?.password?.[0]}
        />
        <Checkbox
          name="acceptTerms"
          required
          label={t.rich("acceptTerms", {
            link: (chunks) => (
              <Anchor href={BRAND.termsPdfUrl} target="_blank" rel="noopener">
                {chunks}
              </Anchor>
            ),
          })}
          error={state?.errors?.acceptTerms?.[0]}
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
