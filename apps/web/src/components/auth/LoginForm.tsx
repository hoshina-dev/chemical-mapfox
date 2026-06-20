"use client";

import {
  Alert,
  Button,
  PasswordInput,
  Stack,
  TextInput,
} from "@mantine/core";
import { useActionState } from "react";

import { login } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action}>
      <Stack gap="md">
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
          Sign in
        </Button>
      </Stack>
    </form>
  );
}
