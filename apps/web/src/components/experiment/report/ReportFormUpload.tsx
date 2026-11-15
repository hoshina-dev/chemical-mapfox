"use client";

import { Alert, Button, FileInput, Stack, Textarea } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { uploadReportFormAction } from "@/app/actions/report-form";

/** Upload a blank report form (PDF) with its field map (JSON). */
export function ReportFormUpload({
  sampleId,
  initialFields,
}: {
  sampleId: string;
  initialFields: string;
}) {
  const t = useTranslations("staff.reportForm");
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState(initialFields);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("fields", fields);
    startTransition(async () => {
      const result = await uploadReportFormAction(sampleId, form);
      setMessage(
        result.success
          ? { ok: true, text: t("saved", { count: result.data.fields }) }
          : { ok: false, text: result.error },
      );
      if (result.success) router.refresh();
    });
  }

  return (
    <Stack gap="md" maw={720}>
      <FileInput
        label={t("fileLabel")}
        description={t("fileDescription")}
        accept="application/pdf"
        value={file}
        onChange={setFile}
        clearable
      />
      <Textarea
        label={t("fieldsLabel")}
        description={t("fieldsDescription")}
        value={fields}
        onChange={(e) => setFields(e.currentTarget.value)}
        autosize
        minRows={8}
        maxRows={24}
        styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
      />
      {message && (
        <Alert color={message.ok ? "green" : "red"} variant="light" style={{ whiteSpace: "pre-line" }}>
          {message.text}
        </Alert>
      )}
      <Button onClick={submit} loading={isPending} disabled={!file} w="fit-content">
        {t("upload")}
      </Button>
    </Stack>
  );
}
