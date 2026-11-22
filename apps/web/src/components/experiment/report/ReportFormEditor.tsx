"use client";

import {
  ActionIcon,
  Alert,
  Grid,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

import { saveReportTableAction } from "@/app/actions/report-form";
import type { ReportForm } from "@/lib/experiment-manager/client";
import {
  addRow,
  editRow,
  type MethodResults,
  removeRow,
} from "@/lib/report/reportTable";

import { ReportFormUpload } from "./ReportFormUpload";

const AUTOSAVE_MS = 800;
const FLASH_MS = 2500;

type SaveStatus =
  | { kind: "idle" | "saving" | "saved" }
  | { kind: "error"; message: string };

/**
 * The report's results table: pick a method on the right and click its results to add
 * rows; give each a label and unit, × removes it. Every change is saved shortly after
 * and the preview on the left (drawn by experiment-manager) reloads.
 */
export function ReportFormEditor({
  sampleId,
  previewUrl,
  initialForm,
  methods,
}: {
  sampleId: string;
  /** The report drawn with sample values from the saved table. */
  previewUrl: string;
  initialForm: ReportForm;
  methods: MethodResults[];
}) {
  const t = useTranslations("staff.reportForm");
  const [form, setForm] = useState<ReportForm>(initialForm);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? null);
  const method = methods.find((m) => m.id === methodId) ?? null;
  const nameOf = (id: string) => methods.find((m) => m.id === id)?.name ?? id;
  const inTable = (template: string, result: string) =>
    form.sections.some(
      (s) => s.template === template && s.rows.some((r) => r.result === result),
    );

  // --- autosave: one save at a time, the latest table wins; the preview follows ---
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [previewVersion, setPreviewVersion] = useState(0);
  const dirty = useRef(false);
  const chain = useRef<Promise<void>>(Promise.resolve());
  // The table as last saved: a refused save puts it back, so the screen never shows
  // a table that is not stored (e.g. a removed row that had to stay).
  const saved = useRef<ReportForm>(initialForm);
  // The table flashes red when a change is undone, then fades back.
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(false), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => {
      dirty.current = false;
      setStatus({ kind: "saving" });
      const sent = form;
      chain.current = chain.current.then(async () => {
        const result = await saveReportTableAction(sampleId, sent);
        if (result.success) {
          saved.current = sent;
          setStatus({ kind: "saved" });
          setPreviewVersion((v) => v + 1);
          return;
        }
        // A newer edit is already queued: let its save decide what stays.
        if (!dirty.current) setForm(saved.current);
        setStatus({ kind: "error", message: result.error });
        setFlash(true);
      });
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [form, sampleId]);
  const update = (change: (prev: ReportForm) => ReportForm) => {
    dirty.current = true;
    setForm(change);
    setStatus((s) => (s.kind === "error" ? { kind: "idle" } : s));
  };

  // --- the preview PDF ---
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [pageHeight, setPageHeight] = useState(0);
  const [width, setWidth] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let loading: { destroy(): Promise<void> } | null = null;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      // Each document gets its own worker (ended by destroy), never a shared one.
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      if (cancelled) return;
      const task = pdfjs.getDocument({ url: `${previewUrl}?v=${previewVersion}` });
      loading = task;
      const loaded = await task.promise;
      if (!cancelled) {
        setDoc(loaded);
        setLoadFailed(false);
        setPage((p) => Math.min(p, loaded.numPages));
      }
    })().catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
      void loading?.destroy();
    };
  }, [previewUrl, previewVersion]);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry?.contentRect.width ?? 0)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [doc]);

  useEffect(() => {
    if (!doc || !canvas.current || width === 0) return;
    let task: { cancel(): void; promise: Promise<void> } | null = null;
    let cancelled = false;
    void doc.getPage(page).then((p) => {
      if (cancelled || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      const scale = width / base.width;
      const viewport = p.getViewport({ scale: scale * window.devicePixelRatio });
      canvas.current.width = viewport.width;
      canvas.current.height = viewport.height;
      setPageHeight(base.height * scale);
      task = p.render({ canvas: canvas.current, viewport });
      task.promise.catch(() => {}); // cancelled by the next render
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, width]);

  const pageCount = doc?.numPages ?? 0;
  return (
    <Stack gap="lg">
      <ReportFormUpload
        sampleId={sampleId}
        hasPdf
        onUploaded={() => {
          setPage(1);
          setDoc(null);
          setPreviewVersion((v) => v + 1);
        }}
      />
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="xs">
            <Group justify="space-between" mih={28}>
              <Text size="sm" c="dimmed">
                {t("previewHint")}
              </Text>
              {pageCount > 1 && (
                <Group gap={4}>
                  <ActionIcon
                    variant="default"
                    aria-label={t("prevPage")}
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <IconChevronLeft size={16} />
                  </ActionIcon>
                  <Text size="sm">{t("page", { page, count: pageCount })}</Text>
                  <ActionIcon
                    variant="default"
                    aria-label={t("nextPage")}
                    disabled={page >= pageCount}
                    onClick={() => setPage(page + 1)}
                  >
                    <IconChevronRight size={16} />
                  </ActionIcon>
                </Group>
              )}
            </Group>
            {loadFailed ? (
              <Alert color="red" variant="light">
                {t("loadError")}
              </Alert>
            ) : (
              <Paper withBorder ref={frame} style={{ overflow: "hidden" }}>
                {!doc && (
                  <Group justify="center" p="xl">
                    <Loader size="sm" />
                  </Group>
                )}
                <canvas
                  ref={canvas}
                  style={{ display: "block", width, height: doc ? pageHeight : 0 }}
                />
              </Paper>
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md" pos="sticky" top={16}>
            {status.kind === "error" && (
              <Alert
                color="red"
                variant="light"
                title={t("notSaved")}
                style={{ whiteSpace: "pre-line" }}
                withCloseButton
                onClose={() => setStatus({ kind: "idle" })}
              >
                {status.message}
              </Alert>
            )}

            <Paper withBorder p="sm">
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  {t("results")}
                </Text>
                {methods.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {t("noExperiments")}
                  </Text>
                ) : (
                  <>
                    <Select
                      aria-label={t("method")}
                      data={methods.map((m) => ({ value: m.id, label: m.name }))}
                      value={methodId}
                      onChange={setMethodId}
                      allowDeselect={false}
                    />
                    {method && method.results.length === 0 && (
                      <Text size="sm" c="dimmed">
                        {t("noResults")}
                      </Text>
                    )}
                    {method?.results.map((result) => {
                      const added = inTable(method.id, result);
                      return (
                        <UnstyledButton
                          key={result}
                          disabled={added}
                          onClick={() => update((f) => addRow(f, method.id, result))}
                          px="xs"
                          py={6}
                          style={{
                            borderRadius: "var(--mantine-radius-sm)",
                            background: added ? "var(--mantine-color-gray-light)" : undefined,
                          }}
                        >
                          <Text size="sm" c={added ? "dimmed" : undefined} truncate>
                            {added ? t("added", { result }) : `+ ${result}`}
                          </Text>
                        </UnstyledButton>
                      );
                    })}
                  </>
                )}
              </Stack>
            </Paper>

            <Stack
              gap="sm"
              p="xs"
              style={{
                // flashes red when a refused change is undone, then fades
                border: `1px solid ${flash ? "var(--mantine-color-red-filled)" : "transparent"}`,
                transition: "border-color 1s ease-out",
                borderRadius: "var(--mantine-radius-md)",
              }}
            >
              <Text size="sm" fw={600}>
                {t("table")}
              </Text>
              {form.sections.length === 0 && (
                <Text size="sm" c="dimmed">
                  {t("emptyTable")}
                </Text>
              )}
              {form.sections.map((section) => (
                <Paper key={section.template} withBorder p="sm">
                  <Stack gap={6}>
                    <Text size="sm" fw={600}>
                      {nameOf(section.template)}
                    </Text>
                    {section.rows.map((row) => (
                      <Group key={row.result} gap={6} wrap="nowrap" align="flex-end">
                        <TextInput
                          label={row.result}
                          placeholder={t("labelPlaceholder")}
                          value={row.label ?? ""}
                          onChange={(e) => {
                            const label = e.currentTarget.value;
                            update((f) => editRow(f, section.template, row.result, { label }));
                          }}
                          size="xs"
                          style={{ flex: 1 }}
                        />
                        <TextInput
                          aria-label={t("unit")}
                          placeholder={t("unit")}
                          value={row.unit ?? ""}
                          onChange={(e) => {
                            const unit = e.currentTarget.value;
                            update((f) => editRow(f, section.template, row.result, { unit }));
                          }}
                          size="xs"
                          w={72}
                        />
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={t("remove", { label: row.label || row.result })}
                          onClick={() => update((f) => removeRow(f, section.template, row.result))}
                          mb={2}
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              ))}
            </Stack>

            <Text size="sm" c="dimmed" aria-live="polite">
              {status.kind === "saving"
                ? t("saving")
                : status.kind === "saved"
                  ? t("saved")
                  : null}
            </Text>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
