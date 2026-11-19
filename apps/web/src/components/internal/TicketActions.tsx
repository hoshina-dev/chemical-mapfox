"use client";

import { Alert, Button, Card, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { closeTicketAction, publishReportAction } from "@/app/actions/experiment";

/**
 * Ticket-level staff actions: preview and publish the report (COMPLETED or CLOSED). The first
 * publish closes the ticket and releases the report to the client; publishing again issues
 * an updated version. Cancel (with a reason) an open ticket.
 */
export function TicketActions({
  contextId,
  status,
  published,
  previewHref,
}: {
  contextId: string;
  status: string;
  /** Whether the report is already published (it can then be downloaded). */
  published: boolean;
  /** What publishing would issue now (nothing recorded, no email). */
  previewHref: string;
}) {
  const t = useTranslations("staff.lifecycle.ticket");
  const router = useRouter();
  const [cancelOpened, cancelModal] = useDisclosure(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canPublish = status === "COMPLETED" || status === "CLOSED";
  const canCancel = !["CLOSED", "CANCELLED"].includes(status);

  function run(call: () => Promise<{ success: boolean; error?: string }>, done?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await call();
      if (!result.success) {
        setError(result.error ?? null);
        return;
      }
      done?.();
      router.refresh();
    });
  }

  if (!canPublish && !canCancel) return null;
  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="sm">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {t("title")}
        </Text>
        {error && !cancelOpened && (
          <Alert color="red" variant="light" style={{ whiteSpace: "pre-line" }}>
            {error}
          </Alert>
        )}
        <Group gap="sm">
          {canPublish && (
            <>
              <Button component="a" href={previewHref} target="_blank" rel="noreferrer" variant="default">
                {t("preview")}
              </Button>
              <Button
                loading={isPending}
                variant={published ? "light" : "filled"}
                onClick={() => {
                  // The first publish closes the ticket and emails the client: confirm every time.
                  if (!window.confirm(t(published ? "republishConfirm" : "publishConfirm"))) return;
                  run(() => publishReportAction(contextId));
                }}
              >
                {t(published ? "republish" : "publish")}
              </Button>
            </>
          )}
          {canCancel && (
            <Button variant="subtle" color="red" onClick={cancelModal.open}>
              {t("cancel")}
            </Button>
          )}
        </Group>
      </Stack>

      <Modal opened={cancelOpened} onClose={cancelModal.close} title={t("cancelTitle")}>
        <Stack gap="md">
          <Textarea
            label={t("cancelReason")}
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
            <Button variant="default" onClick={cancelModal.close}>
              {t("dismiss")}
            </Button>
            <Button color="red" loading={isPending} disabled={!reason.trim()} onClick={() => run(() => closeTicketAction(contextId, reason), cancelModal.close)}>
              {t("cancelConfirm")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}
