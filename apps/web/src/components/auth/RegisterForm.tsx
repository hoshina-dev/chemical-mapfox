"use client";

import {
  Alert,
  Button,
  PasswordInput,
  Stack,
  TextInput,
} from "@mantine/core";
import { useActionState, useState } from "react";

import { register } from "@/app/actions/auth";

import { OrganizationSelect } from "./OrganizationSelect";

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  return (
    <form action={action}>
      <Stack gap="md">
        <TextInput
          label="Name"
          name="name"
          autoComplete="name"
          required
          error={state?.errors?.name?.[0]}
        />
        <TextInput
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state?.errors?.email?.[0]}
        />
        <PasswordInput
          label="Password"
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
          Create account
        </Button>
      </Stack>
    </form>
  );
}
