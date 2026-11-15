"use client";

import {
  Alert,
  Button,
  Card,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { closeTicketAction, publishReportAction } from "@/app/actions/experiment";
import type { PublishReport } from "@/lib/sample-tracker/client";

const EMPTY_REPORT: PublishReport = {
  reportNumber: "",
  orderNumber: "",
  client: { name: "", address: "", postcodeCity: "", taxId: "" },
  authorizedBy: { name: "", title: "" },
};

/**
 * Ticket-level staff actions: publish the report (COMPLETED or CLOSED, pre-filled
 * from the last publish), close a completed ticket, cancel an open one.
 */
export function TicketActions({
  contextId,
  status,
  lastPublish,
}: {
  contextId: string;
  status: string;
  /** What the latest publish recorded, to pre-fill the dialog. */
  lastPublish: PublishReport | null;
}) {
  const t = useTranslations("staff.lifecycle.ticket");
  const router = useRouter();
  const [publishOpened, publishModal] = useDisclosure(false);
  const [cancelOpened, cancelModal] = useDisclosure(false);
  const [report, setReport] = useState<PublishReport>(lastPublish ?? EMPTY_REPORT);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canPublish = status === "COMPLETED" || status === "CLOSED";
  const canClose = status === "COMPLETED";
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

  const field = (label: string, value: string, set: (v: string) => void, required = false) => (
    <TextInput label={label} value={value} required={required} onChange={(e) => set(e.currentTarget.value)} />
  );

  if (!canPublish && !canClose && !canCancel) return null;
  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="sm">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {t("title")}
        </Text>
        {error && !publishOpened && !cancelOpened && (
          <Alert color="red" variant="light" style={{ whiteSpace: "pre-line" }}>
            {error}
          </Alert>
        )}
        <Group gap="sm">
          {canPublish && (
            <Button onClick={publishModal.open}>{lastPublish ? t("republish") : t("publish")}</Button>
          )}
          {canClose && (
            <Button variant="light" color="green" loading={isPending} onClick={() => run(() => closeTicketAction(contextId))}>
              {t("close")}
            </Button>
          )}
          {canCancel && (
            <Button variant="subtle" color="red" onClick={cancelModal.open}>
              {t("cancel")}
            </Button>
          )}
        </Group>
      </Stack>

      <Modal opened={publishOpened} onClose={publishModal.close} title={t("publishTitle")} size="lg">
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {field(t("reportNumber"), report.reportNumber, (v) => setReport({ ...report, reportNumber: v }), true)}
            {field(t("orderNumber"), report.orderNumber, (v) => setReport({ ...report, orderNumber: v }))}
          </SimpleGrid>
          {field(t("clientName"), report.client.name, (v) => setReport({ ...report, client: { ...report.client, name: v } }), true)}
          {field(t("clientAddress"), report.client.address, (v) => setReport({ ...report, client: { ...report.client, address: v } }))}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {field(t("clientPostcodeCity"), report.client.postcodeCity, (v) => setReport({ ...report, client: { ...report.client, postcodeCity: v } }))}
            {field(t("clientTaxId"), report.client.taxId, (v) => setReport({ ...report, client: { ...report.client, taxId: v } }))}
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {field(t("signerName"), report.authorizedBy.name, (v) => setReport({ ...report, authorizedBy: { ...report.authorizedBy, name: v } }), true)}
            {field(t("signerTitle"), report.authorizedBy.title, (v) => setReport({ ...report, authorizedBy: { ...report.authorizedBy, title: v } }))}
          </SimpleGrid>
          {error && (
            <Alert color="red" variant="light" style={{ whiteSpace: "pre-line" }}>
              {error}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={publishModal.close}>
              {t("dismiss")}
            </Button>
            <Button loading={isPending} onClick={() => run(() => publishReportAction(contextId, report), publishModal.close)}>
              {t("publishConfirm")}
            </Button>
          </Group>
        </Stack>
      </Modal>

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
