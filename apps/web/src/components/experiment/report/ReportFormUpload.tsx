"use client";

import { Alert, Button, FileButton, Group, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { uploadReportFormPdfAction } from "@/app/actions/report-form";

/** Upload or replace the blank report form (PDF); the results table is kept. */
export function ReportFormUpload({
  sampleId,
  hasPdf,
  onUploaded,
}: {
  sampleId: string;
  hasPdf: boolean;
  /** Called after a successful upload (the editor reloads the PDF). */
  onUploaded?: () => void;
}) {
  const t = useTranslations("staff.reportForm");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function upload(file: File | null) {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    setError(null);
    startTransition(async () => {
      const result = await uploadReportFormPdfAction(sampleId, form);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onUploaded?.();
      router.refresh();
    });
  }

  return (
    <Stack gap="xs">
      <Group gap="sm">
        <Text size="sm" fw={500}>
          {t("fileLabel")}
        </Text>
        <FileButton onChange={upload} accept="application/pdf">
          {(props) => (
            <Button
              {...props}
              variant={hasPdf ? "default" : "filled"}
              loading={isPending}
              size="xs"
            >
              {hasPdf ? t("replaceFile") : t("chooseFile")}
            </Button>
          )}
        </FileButton>
        <Text size="xs" c="dimmed">
          {t("fileDescription")}
        </Text>
      </Group>
      {error && (
        <Alert color="red" variant="light" style={{ whiteSpace: "pre-line" }}>
          {error}
        </Alert>
      )}
    </Stack>
  );
}
