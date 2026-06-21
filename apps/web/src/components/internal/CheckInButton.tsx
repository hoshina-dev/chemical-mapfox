"use client";

import { Alert, Button, Stack } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { checkInSampleAction } from "@/app/actions/experiment";
import { experimentWorkspacePath } from "@/lib/experiment-manager/routes";

/**
 * Confirms a shipped sample has arrived (REQUESTED → PENDING) and forwards the
 * technician to the experiment workspace, where they can start the experiment.
 */
export function CheckInButton({ contextId }: { contextId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    startTransition(async () => {
      const result = await checkInSampleAction(contextId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      // Keep the transition pending while navigating to the workspace.
      router.push(experimentWorkspacePath(contextId));
    });
  }

  return (
    <Stack gap="sm">
      {error && (
        <Alert
          color="red"
          variant="light"
          title="Could not check in"
          style={{ whiteSpace: "pre-line" }}
        >
          {error}
        </Alert>
      )}
      <Button size="md" onClick={onClick} loading={isPending} w="fit-content">
        Check in sample
      </Button>
    </Stack>
  );
}
