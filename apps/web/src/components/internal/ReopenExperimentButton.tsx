"use client";

import { Alert, Button, Group, Modal, Stack, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { reopenExperimentAction } from "@/app/actions/experiment";

/** Reopen a finished experiment, with a reason, so its values can be corrected. */
export function ReopenExperimentButton({
  contextId,
  experimentId,
}: {
  contextId: string;
  experimentId: string;
}) {
  const t = useTranslations("staff.lifecycle.reopen");
  const router = useRouter();
  const [opened, { open, close }] = useDisclosure(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await reopenExperimentAction(contextId, experimentId, reason);
      if (!result.success) {
        setError(result.error);
        return;
      }
      close();
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="light" color="orange" onClick={open} w="fit-content">
        {t("button")}
      </Button>
      <Modal opened={opened} onClose={close} title={t("title")}>
        <Stack gap="md">
          <Textarea
            label={t("reason")}
            description={t("reasonDescription")}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            autosize
            minRows={2}
            required
          />
          {error && (
            <Alert color="red" variant="light" style={{ whiteSpace: "pre-line" }}>
              {error}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              {t("cancel")}
            </Button>
            <Button color="orange" onClick={submit} loading={isPending} disabled={!reason.trim()}>
              {t("confirm")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
