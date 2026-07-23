"use client";

import {
  Alert,
  Button,
  PasswordInput,
  Stack,
  TextInput,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { register } from "@/app/actions/auth";

import { OrganizationSelect } from "./OrganizationSelect";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
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
        <OrganizationSelect
          value={organizationId}
          onChange={setOrganizationId}
          error={state?.errors?.organizationId?.[0]}
        />
        <input type="hidden" name="organizationId" value={organizationId ?? ""} />

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
