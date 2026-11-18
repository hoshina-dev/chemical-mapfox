"use client";

import {
  Accordion,
  ActionIcon,
  Alert,
  Box,
  Grid,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { saveReportFieldsAction } from "@/app/actions/report-form";
import {
  EXPERIMENT_KINDS,
  type ExperimentFields,
  type FieldKind,
  fieldKind,
  type FieldOption,
  GENERAL_SOURCES,
  moveField,
  type PageSize,
  placeField,
} from "@/lib/report/reportFields";
import type { ReportField } from "@/lib/experiment-manager/client";

import { ReportFormUpload } from "./ReportFormUpload";

const AUTOSAVE_MS = 800;
/** Every value prints in one fixed format: Helvetica 10 pt, starting at its point. */
const TEXT_PT = 10;
/** One colour per kind of value, in the list and on the page. */
const KIND_COLOR: Record<FieldKind, string> = {
  general: "indigo",
  result: "orange",
  lab: "grape",
  client: "teal",
};

interface Item {
  key: number;
  field: ReportField;
}

type SaveStatus =
  | { kind: "idle" | "saving" | "saved" }
  | { kind: "error"; message: string };

/**
 * Place report values on the blank form: pick a value on the right, click the
 * page where it prints; drag (or arrow keys) to move, Delete or × to remove.
 * Every change is saved shortly after.
 */
export function ReportFormEditor({
  sampleId,
  pdfUrl,
  initialFields,
  experiments,
  labels,
}: {
  sampleId: string;
  pdfUrl: string;
  initialFields: ReportField[];
  experiments: ExperimentFields[];
  /** Names of the experiments' values ("Method · value"). */
  labels: Record<string, string>;
}) {
  const t = useTranslations("staff.reportForm");
  const nextKey = useRef(initialFields.length);
  const [items, setItems] = useState<Item[]>(() =>
    initialFields.map((field, key) => ({ key, field })),
  );
  const [armed, setArmed] = useState<FieldOption | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [experimentId, setExperimentId] = useState(experiments[0]?.id ?? null);

  const offered = useMemo(
    () => new Set<string>([...GENERAL_SOURCES, ...Object.keys(labels)]),
    [labels],
  );
  const labelOf = useCallback(
    (source: string) =>
      t.has(`sources.${source}`)
        ? t(`sources.${source}`)
        : (labels[source] ?? source),
    [t, labels],
  );
  const general = GENERAL_SOURCES.map((source) => ({
    source,
    label: labelOf(source),
  }));
  const experiment = experiments.find((e) => e.id === experimentId) ?? null;
  // The value picked in the list (or of the selected chip): all its placements light up.
  const focusSource =
    armed?.source ??
    items.find((i) => i.key === selected)?.field.source ??
    null;

  // --- autosave: one save at a time, the latest fields win ---
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const dirty = useRef(false);
  const chain = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!dirty.current) return;
    const fields = items.map((i) => i.field);
    const timer = setTimeout(() => {
      dirty.current = false;
      setStatus({ kind: "saving" });
      chain.current = chain.current.then(async () => {
        const result = await saveReportFieldsAction(sampleId, fields);
        setStatus(
          result.success
            ? { kind: "saved" }
            : { kind: "error", message: result.error },
        );
      });
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [items, sampleId]);
  const update = (change: (prev: Item[]) => Item[]) => {
    dirty.current = true;
    setItems(change);
  };

  // --- the PDF ---
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize | null>(null);
  const [width, setWidth] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // Bumped after Replace PDF, so the new form is loaded (placed values stay).
  const [pdfVersion, setPdfVersion] = useState(0);
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
      const task = pdfjs.getDocument({ url: `${pdfUrl}?v=${pdfVersion}` });
      loading = task;
      const loaded = await task.promise;
      if (!cancelled) setDoc(loaded);
    })().catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
      void loading?.destroy();
    };
  }, [pdfUrl, pdfVersion]);

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
      const viewport = p.getViewport({
        scale: scale * window.devicePixelRatio,
      });
      canvas.current.width = viewport.width;
      canvas.current.height = viewport.height;
      setPageSize({ width: base.width, height: base.height });
      task = p.render({ canvas: canvas.current, viewport });
      task.promise.catch(() => {}); // cancelled by the next render
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, width]);

  const scale = pageSize ? width / pageSize.width : 0;

  // --- interactions ---
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setArmed(null);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function clickPage(e: PointerEvent<HTMLDivElement>) {
    if (!armed || !pageSize) {
      setSelected(null);
      return;
    }
    const box = e.currentTarget.getBoundingClientRect();
    const field = placeField(
      armed.source,
      page,
      (e.clientX - box.left) / scale,
      (e.clientY - box.top) / scale,
      pageSize,
    );
    const key = nextKey.current++;
    update((prev) => [...prev, { key, field }]);
    setSelected(key);
    setArmed(null);
  }

  const drag = useRef<{
    key: number;
    x: number;
    y: number;
    from: ReportField;
  } | null>(null);
  function startDrag(e: PointerEvent<HTMLDivElement>, item: Item) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      key: item.key,
      x: e.clientX,
      y: e.clientY,
      from: item.field,
    };
    setSelected(item.key);
    setArmed(null);
  }
  function onDrag(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || !pageSize || (e.clientX === d.x && e.clientY === d.y)) return;
    const moved = moveField(
      d.from,
      (e.clientX - d.x) / scale,
      (e.clientY - d.y) / scale,
      pageSize,
    );
    update((prev) =>
      prev.map((i) => (i.key === d.key ? { ...i, field: moved } : i)),
    );
  }
  const remove = (key: number) => {
    update((prev) => prev.filter((i) => i.key !== key));
    setSelected(null);
  };
  function onChipKey(e: KeyboardEvent<HTMLDivElement>, item: Item) {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove(item.key);
      return;
    }
    const step = e.shiftKey ? 5 : 0.5;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[e.key];
    if (!d || !pageSize) return;
    e.preventDefault();
    update((prev) =>
      prev.map((i) =>
        i.key === item.key
          ? { ...i, field: moveField(i.field, d[0], d[1], pageSize) }
          : i,
      ),
    );
  }

  const option = (o: FieldOption) => {
    const active = armed?.source === o.source;
    const color = KIND_COLOR[fieldKind(o.source)];
    return (
      <UnstyledButton
        key={o.source}
        onClick={() => {
          setSelected(null);
          setArmed(active ? null : o);
        }}
        px="xs"
        py={6}
        style={{
          borderRadius: "var(--mantine-radius-sm)",
          background:
            focusSource === o.source
              ? `var(--mantine-color-${color}-light)`
              : undefined,
        }}
      >
        <Group gap="xs" wrap="nowrap">
          <Box
            w={8}
            h={8}
            style={{
              flexShrink: 0,
              borderRadius: "50%",
              background: `var(--mantine-color-${color}-filled)`,
            }}
          />
          <Text size="sm" truncate>
            {o.label}
          </Text>
        </Group>
      </UnstyledButton>
    );
  };
  const experimentValues = experiment
    ? EXPERIMENT_KINDS.filter((kind) => experiment.fields[kind].length > 0)
    : [];

  const pageCount = doc?.numPages ?? 0;
  return (
    <Stack gap="lg">
      <ReportFormUpload
        sampleId={sampleId}
        hasPdf
        onUploaded={() => {
          setPage(1);
          setDoc(null);
          setLoadFailed(false);
          setPdfVersion((v) => v + 1);
        }}
      />
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="xs">
            <Group justify="space-between" mih={28}>
              <Text size="sm" c={armed ? "blue" : "dimmed"}>
                {armed ? t("placeHint", { label: armed.label }) : t("pickHint")}
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
              <Paper
                withBorder
                ref={frame}
                pos="relative"
                style={{ overflow: "hidden" }}
              >
                {!doc && (
                  <Group justify="center" p="xl">
                    <Loader size="sm" />
                  </Group>
                )}
                <canvas
                  ref={canvas}
                  style={{
                    display: "block",
                    width,
                    height: pageSize ? pageSize.height * scale : 0,
                  }}
                />
                <Box
                  pos="absolute"
                  inset={0}
                  onPointerDown={clickPage}
                  style={{ cursor: armed ? "crosshair" : "default" }}
                >
                  {scale > 0 &&
                    items
                      .filter((i) => i.field.page === page)
                      .map((item) => {
                        const { field } = item;
                        const isSelected = selected === item.key;
                        const known = offered.has(field.source);
                        const lit = field.source === focusSource;
                        const color = known
                          ? KIND_COLOR[fieldKind(field.source)]
                          : "gray";
                        return (
                          <Box
                            key={item.key}
                            pos="absolute"
                            left={field.x * scale}
                            top={field.y * scale}
                          >
                            <Box
                              tabIndex={0}
                              role="button"
                              aria-label={labelOf(field.source)}
                              onPointerDown={(e) => startDrag(e, item)}
                              onPointerMove={onDrag}
                              onPointerUp={() => (drag.current = null)}
                              onKeyDown={(e) => onChipKey(e, item)}
                              onFocus={() => setSelected(item.key)}
                              pos="absolute"
                              bottom={0}
                              style={{
                                fontSize: TEXT_PT * scale,
                                lineHeight: 1,
                                whiteSpace: "nowrap",
                                padding: "0 2px",
                                cursor: "move",
                                touchAction: "none",
                                userSelect: "none",
                                // Lit (picked in the list, or the same value as the
                                // selected chip): filled in its colour.
                                color: lit
                                  ? "var(--mantine-color-white)"
                                  : `var(--mantine-color-${color}-9)`,
                                background: lit
                                  ? `var(--mantine-color-${color}-filled)`
                                  : known
                                    ? `var(--mantine-color-${color}-light)`
                                    : "repeating-linear-gradient(45deg, rgba(134,142,150,.15) 0 4px, transparent 4px 8px)",
                                outline: `1px ${known ? "solid" : "dashed"} var(--mantine-color-${color}-${lit ? 9 : 6})`,
                                outlineWidth: isSelected || lit ? 2 : 1,
                              }}
                            >
                              {labelOf(field.source)}
                              {isSelected && (
                                <ActionIcon
                                  size={16}
                                  radius="xl"
                                  color="red"
                                  aria-label={t("remove", {
                                    label: labelOf(field.source),
                                  })}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={() => remove(item.key)}
                                  pos="absolute"
                                  top={-18}
                                  right={-10}
                                >
                                  <IconX size={12} />
                                </ActionIcon>
                              )}
                            </Box>
                            <Box
                              pos="absolute"
                              w={4}
                              h={4}
                              style={{
                                borderRadius: "50%",
                                transform: "translate(-50%, -50%)",
                                background: `var(--mantine-color-${color}-7)`,
                                pointerEvents: "none",
                              }}
                            />
                          </Box>
                        );
                      })}
                </Box>
              </Paper>
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="sm" pos="sticky" top={16}>
            <Accordion
              multiple
              variant="separated"
              defaultValue={["general", "experiment"]}
            >
              <Accordion.Item value="general">
                <Accordion.Control>{t("general")}</Accordion.Control>
                <Accordion.Panel>
                  <Stack gap={2}>{general.map(option)}</Stack>
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item value="experiment">
                <Accordion.Control>{t("experiment")}</Accordion.Control>
                <Accordion.Panel>
                  {experiments.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      {t("noExperiments")}
                    </Text>
                  ) : (
                    <Stack gap="xs">
                      <Select
                        aria-label={t("experiment")}
                        data={experiments.map((e) => ({
                          value: e.id,
                          label: e.name,
                        }))}
                        value={experimentId}
                        onChange={setExperimentId}
                        allowDeselect={false}
                      />
                      {experiment && experimentValues.length > 0 ? (
                        experimentValues.map((kind) => (
                          <Stack key={kind} gap={2}>
                            <Text
                              size="xs"
                              fw={600}
                              c="dimmed"
                              tt="uppercase"
                              px="xs"
                            >
                              {t(`kinds.${kind}`)}
                            </Text>
                            {experiment.fields[kind].map(option)}
                          </Stack>
                        ))
                      ) : (
                        <Text size="sm" c="dimmed">
                          {t("noFields")}
                        </Text>
                      )}
                    </Stack>
                  )}
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
            <Text
              size="sm"
              c={status.kind === "error" ? "red" : "dimmed"}
              style={{ whiteSpace: "pre-line" }}
              aria-live="polite"
            >
              {status.kind === "error"
                ? status.message
                : status.kind === "saving"
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
