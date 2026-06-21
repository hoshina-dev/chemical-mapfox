"use client";

import { Alert, Button, Stack } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { startExperimentAction } from "@/app/actions/experiment";

/**
 * Starts the experiment (PENDING → EXPERIMENTING), which unlocks the
 * collaborative lab-form editor. Refreshes the workspace in place so the
 * read-only view becomes the live editor.
 */
export function StartExperimentButton({ contextId }: { contextId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    startTransition(async () => {
      const result = await startExperimentAction(contextId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Stack gap="sm">
      {error && (
        <Alert
          color="red"
          variant="light"
          title="Could not start experiment"
          style={{ whiteSpace: "pre-line" }}
        >
          {error}
        </Alert>
      )}
      <Button onClick={onClick} loading={isPending} w="fit-content">
        Start experiment
      </Button>
    </Stack>
  );
}
