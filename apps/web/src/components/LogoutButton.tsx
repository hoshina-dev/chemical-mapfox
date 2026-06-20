"use client";

import { Button } from "@mantine/core";
import { useTransition } from "react";

import { logout } from "@/app/actions/auth";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="light"
      loading={pending}
      onClick={() => startTransition(() => void logout())}
    >
      Log out
    </Button>
  );
}
