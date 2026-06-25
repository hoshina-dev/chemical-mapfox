"use client";

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  ColorInput,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  getExperimentPreviewContextAction,
  type PdfPreviewExperiment,
  savePdfTemplateAction,
} from "@/app/actions/pdf";
import { templatePdfPath } from "@/lib/experiment-manager/routes";

import type {
  PageBreakComp,
  PdfComp,
  PreviewMode,
  Rect,
  ShapeComp,
  TextComp,
  VariableGroup,
} from "./types";

// ── Constants ──────────────────────────────────────────────────────────────
const PAGE_W = 612;
const PAGE_H = 792;

// ── Helpers ────────────────────────────────────────────────────────────────
function interpolate(text: string, ctx: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    k in ctx ? String(ctx[k]) : `{{${k}}}`,
  );
}

function cssTop(rect: Rect): number {
  return PAGE_H - rect[1] - rect[3];
}

function splitPages(comps: PdfComp[]): PdfComp[][] {
  const pages: PdfComp[][] = [[]];
  for (const c of comps) {
    if (c.type === "pagebreak") pages.push([]);
    else pages[pages.length - 1]!.push(c);
  }
  return pages;
}

function getPageRange(
  comps: PdfComp[],
  pageIdx: number,
): { start: number; end: number } {
  let page = 0,
    start = 0;
  for (let i = 0; i < comps.length; i++) {
    if (comps[i]!.type === "pagebreak") {
      if (page === pageIdx) return { start, end: i };
      page++;
      start = i + 1;
    }
  }
  return { start, end: comps.length };
}

function newTextComp(): TextComp {
  return {
    id: `text_${Date.now()}`,
    type: "text",
    content: "",
    rect: [50, 680, 512, 30],
    style: {
      font: "Helvetica",
      size: 12,
      bold: false,
      italic: false,
      align: "left",
      color: "#000000",
    },
  };
}

function newShapeComp(): ShapeComp {
  return {
    id: `shape_${Date.now()}`,
    type: "shape",
    shape_type: "rect",
    rect: [50, 680, 200, 50],
    color: "#000000",
    stroke_width: 1,
    fill: false,
  };
}

function newPageBreak(): PageBreakComp {
  return { id: `pb_${Date.now()}`, type: "pagebreak" };
}

function shapeToSvg(comp: ShapeComp): string {
  const [, , w, h] = comp.rect;
  const c = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(comp.color)
    ? comp.color
    : "#000000";
  const sw =
    isFinite(comp.stroke_width) && comp.stroke_width > 0
      ? comp.stroke_width
      : 1;
  const fill = comp.fill ? c : "none";
  const half = sw / 2;
  let inner = "";
  if (comp.shape_type === "rect") {
    inner = `<rect x="${half}" y="${half}" width="${Math.max(0, w - sw)}" height="${Math.max(0, h - sw)}" stroke="${c}" stroke-width="${sw}" fill="${fill}"/>`;
  } else if (comp.shape_type === "line") {
    inner = `<line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="${c}" stroke-width="${sw}"/>`;
  } else if (comp.shape_type === "circle") {
    const r = Math.max(0, Math.min(w, h) / 2 - half);
    inner = `<circle cx="${w / 2}" cy="${h / 2}" r="${r}" stroke="${c}" stroke-width="${sw}" fill="${fill}"/>`;
  }
  return `<svg width="${w}" height="${h}" style="display:block;overflow:visible">${inner}</svg>`;
}

// ── Props ──────────────────────────────────────────────────────────────────
interface PdfEditorProps {
  sampleId: string;
  templateId: string;
  lineageId: string;
  initialComponents: PdfComp[];
  variableGroups: VariableGroup[];
  questionDefaults: Record<string, unknown>;
  experiments: PdfPreviewExperiment[];
}

// ── Component state reducer ────────────────────────────────────────────────
type Action =
  | { type: "SET_COMPS"; comps: PdfComp[] }
  | { type: "ADD_COMP"; comp: PdfComp; insertAt: number }
  | { type: "UPDATE_COMP"; id: string; patch: Partial<PdfComp> }
  | { type: "DELETE_COMP"; id: string }
  | { type: "MOVE_RECT"; id: string; x: number; y: number };

function compsReducer(state: PdfComp[], action: Action): PdfComp[] {
  switch (action.type) {
    case "SET_COMPS":
      return action.comps;
    case "ADD_COMP": {
      const next = [...state];
      next.splice(action.insertAt, 0, action.comp);
      return next;
    }
    case "UPDATE_COMP":
      return state.map((c) =>
        c.id === action.id ? ({ ...c, ...action.patch } as PdfComp) : c,
      );
    case "DELETE_COMP":
      return state.filter((c) => c.id !== action.id);
    case "MOVE_RECT":
      return state.map((c) => {
        if (c.id !== action.id || c.type === "pagebreak") return c;
        const rect: Rect = [action.x, action.y, c.rect[2], c.rect[3]];
        return { ...c, rect };
      });
    default:
      return state;
  }
}

// ── Main component ─────────────────────────────────────────────────────────
export function PdfEditor({
  sampleId,
  templateId,
  lineageId,
  initialComponents,
  variableGroups,
  questionDefaults,
  experiments,
}: PdfEditorProps) {
  const router = useRouter();
  const [comps, dispatch] = useReducer(compsReducer, initialComponents);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("raw");
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null);
  const [editorContext, setEditorContext] = useState<Record<string, unknown>>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    pageIdx: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const onExperimentSelect = useCallback(async (expId: string | null) => {
    setSelectedExpId(expId);
    if (!expId) {
      setEditorContext({});
      return;
    }
    const result = await getExperimentPreviewContextAction(expId);
    setEditorContext(result.success ? result.data : {});
  }, []);

  // ── Drag handlers ────────────────────────────────────────────────────────
  const startDrag = useCallback(
    (e: React.MouseEvent, id: string, pageIdx: number) => {
      e.preventDefault();
      e.stopPropagation();
      const comp = comps.find((c) => c.id === id);
      if (!comp || comp.type === "pagebreak") return;

      const pageEl = canvasRef.current?.querySelector<HTMLElement>(
        `[data-page="${pageIdx}"]`,
      );
      if (!pageEl) return;
      const rect = pageEl.getBoundingClientRect();
      dragRef.current = {
        id,
        pageIdx,
        offsetX: e.clientX - rect.left - comp.rect[0],
        offsetY: e.clientY - rect.top - cssTop(comp.rect),
      };
      setActivePage(pageIdx);
      setSelectedId(id);
    },
    [comps],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const comp = comps.find((c) => c.id === drag.id);
      if (!comp || comp.type === "pagebreak") return;
      const pageEl = canvasRef.current?.querySelector<HTMLElement>(
        `[data-page="${drag.pageIdx}"]`,
      );
      if (!pageEl) return;
      const rect = pageEl.getBoundingClientRect();
      const cssX = Math.max(
        0,
        Math.min(e.clientX - rect.left - drag.offsetX, PAGE_W - comp.rect[2]),
      );
      const cssY = Math.max(
        0,
        Math.min(e.clientY - rect.top - drag.offsetY, PAGE_H - comp.rect[3]),
      );
      const y = Math.round(PAGE_H - cssY - comp.rect[3]);
      dispatch({ type: "MOVE_RECT", id: drag.id, x: Math.round(cssX), y });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [comps]);

  // ── Add / delete ─────────────────────────────────────────────────────────
  const addText = () => {
    const { end } = getPageRange(comps, activePage);
    const comp = newTextComp();
    dispatch({ type: "ADD_COMP", comp, insertAt: end });
    setSelectedId(comp.id);
  };

  const addShape = () => {
    const { end } = getPageRange(comps, activePage);
    const comp = newShapeComp();
    dispatch({ type: "ADD_COMP", comp, insertAt: end });
    setSelectedId(comp.id);
  };

  const addPageBreak = () => {
    const { end } = getPageRange(comps, activePage);
    dispatch({ type: "ADD_COMP", comp: newPageBreak(), insertAt: end });
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    dispatch({ type: "DELETE_COMP", id: selectedId });
    setSelectedId(null);
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    const result = await savePdfTemplateAction(
      sampleId,
      lineageId,
      comps,
      templateId,
    );
    setSaving(false);
    if (!result.success) {
      setSaveMsg({ text: result.error, ok: false });
      return;
    }
    setSaveMsg({ text: "Saved", ok: true });
    if (result.data.templateId !== templateId) {
      router.push(
        templatePdfPath({
          sampleId,
          templateId: result.data.templateId,
        }),
      );
      router.refresh();
    }
    setTimeout(() => setSaveMsg(null), 2500);
  };

  // ── Canvas scroll → active page ──────────────────────────────────────────
  const onScroll = () => {
    const container = canvasRef.current;
    if (!container) return;
    const top = container.scrollTop;
    const bottom = top + container.clientHeight;
    let bestPage = activePage,
      bestVisible = 0;
    container.querySelectorAll<HTMLElement>("[data-page]").forEach((el) => {
      const pt = el.offsetTop,
        pb = pt + el.offsetHeight;
      const visible = Math.max(0, Math.min(pb, bottom) - Math.max(pt, top));
      if (visible > bestVisible) {
        bestVisible = visible;
        bestPage = parseInt(el.dataset.page!);
      }
    });
    if (bestPage !== activePage) setActivePage(bestPage);
  };

  const selectedComp = selectedId
    ? (comps.find((c) => c.id === selectedId) ?? null)
    : null;
  const pages = splitPages(comps);

  // ── Copy variable to clipboard ────────────────────────────────────────────
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const copyVar = (varId: string) => {
    navigator.clipboard.writeText(`{{${varId}}}`).then(() => {
      setCopiedVar(varId);
      setTimeout(() => setCopiedVar(null), 1500);
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 60px)",
        overflow: "hidden",
      }}
    >
      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <Paper
        withBorder
        p="xs"
        radius={0}
        style={{ borderLeft: "none", borderRight: "none", borderTop: "none" }}
      >
        <Group gap="sm" wrap="nowrap">
          <Text fw={600} size="sm">
            PDF Template
          </Text>
          <Button size="xs" onClick={addText}>
            + Text
          </Button>
          <Button size="xs" variant="default" onClick={addShape}>
            + Shape
          </Button>
          <Button size="xs" variant="default" onClick={addPageBreak}>
            + Page
          </Button>
          <Button
            size="xs"
            color="red"
            variant="light"
            onClick={deleteSelected}
            disabled={!selectedId}
          >
            Delete
          </Button>
          <div style={{ flex: 1 }} />

          {/* Preview mode */}
          <Select
            size="xs"
            w={160}
            value={previewMode}
            onChange={(v) => {
              const mode = (v ?? "raw") as PreviewMode;
              setPreviewMode(mode);
              if (mode === "experiment") {
                setEditorContext({});
              } else {
                setSelectedExpId(null);
                setEditorContext(
                  mode === "defaults" ? { ...questionDefaults } : {},
                );
              }
            }}
            data={[
              { value: "raw", label: "Show placeholders" },
              { value: "defaults", label: "Use defaults" },
              { value: "experiment", label: "From experiment" },
            ]}
          />
          {previewMode === "experiment" && (
            <Select
              size="xs"
              w={260}
              placeholder="Pick experiment…"
              value={selectedExpId}
              onChange={onExperimentSelect}
              data={
                experiments.length > 0
                  ? experiments.map((e) => ({ value: e.id, label: e.label }))
                  : []
              }
              disabled={experiments.length === 0}
            />
          )}

          <Button size="xs" loading={saving} onClick={save}>
            Save
          </Button>
          {saveMsg && (
            <Badge color={saveMsg.ok ? "green" : "red"} variant="light">
              {saveMsg.text}
            </Badge>
          )}
        </Group>
      </Paper>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Left panel ─────────────────────────────────────────────── */}
        <Paper
          withBorder
          radius={0}
          w={220}
          style={{
            borderLeft: "none",
            borderTop: "none",
            borderBottom: "none",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <ScrollArea style={{ flex: 1 }} p="sm">
            <Stack gap="sm">
              {/* Variables */}
              <div>
                <Text fw={600} size="xs" mb={4}>
                  Variables
                </Text>
                <Text size="xs" c="dimmed" mb={6}>
                  Click to copy <code>{"{{name}}"}</code>
                </Text>
                {variableGroups.map((group) => (
                  <div key={group.name} style={{ marginBottom: 8 }}>
                    <Text size="xs" fw={500} c="dimmed" mb={2}>
                      {group.name}
                    </Text>
                    <Stack gap={2}>
                      {group.variables.map((v) => (
                        <Tooltip
                          key={v.id}
                          label={copiedVar === v.id ? "Copied!" : `{{${v.id}}}`}
                          position="right"
                          withArrow
                        >
                          <Box
                            onClick={() => copyVar(v.id)}
                            style={{
                              cursor: "pointer",
                              padding: "2px 6px",
                              borderRadius: 4,
                              background:
                                copiedVar === v.id
                                  ? "var(--mantine-color-green-1)"
                                  : "var(--mantine-color-default-hover)",
                              fontSize: 11,
                              fontFamily: "monospace",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {v.label}
                          </Box>
                        </Tooltip>
                      ))}
                    </Stack>
                  </div>
                ))}
              </div>

              {/* Component list */}
              <div>
                <Text fw={600} size="xs" mb={4}>
                  Components
                </Text>
                <Stack gap={2}>
                  {comps.map((c) =>
                    c.type === "pagebreak" ? (
                      <Text
                        key={c.id}
                        size="xs"
                        c="dimmed"
                        style={{
                          borderTop:
                            "1px dashed var(--mantine-color-default-border)",
                          paddingTop: 2,
                          marginTop: 2,
                        }}
                      >
                        — page break —
                      </Text>
                    ) : (
                      <Box
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        style={{
                          cursor: "pointer",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 11,
                          background:
                            c.id === selectedId
                              ? "var(--mantine-color-blue-1)"
                              : "var(--mantine-color-default-hover)",
                          display: "flex",
                          gap: 4,
                        }}
                      >
                        <Text
                          size="xs"
                          c="blue"
                          style={{ fontFamily: "monospace" }}
                        >
                          {c.type}
                        </Text>
                        <Text
                          size="xs"
                          c="dimmed"
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.id.slice(0, 12)}
                        </Text>
                      </Box>
                    ),
                  )}
                </Stack>
              </div>
            </Stack>
          </ScrollArea>
        </Paper>

        {/* ── Canvas ─────────────────────────────────────────────────── */}
        <div
          ref={canvasRef}
          onScroll={onScroll}
          onClick={() => setSelectedId(null)}
          style={{
            flex: 1,
            overflow: "auto",
            background: "#444",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "24px 0",
            gap: 0,
          }}
        >
          {pages.map((pageComps, pageIdx) => (
            <div key={pageIdx}>
              {pages.length > 1 && (
                <Text
                  size="xs"
                  style={{
                    color: pageIdx === activePage ? "#beffb6" : "#ddd",
                    textAlign: "center",
                    padding: "6px 0",
                  }}
                >
                  Page {pageIdx + 1}
                </Text>
              )}
              <div
                data-page={pageIdx}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "relative",
                  width: PAGE_W,
                  height: PAGE_H,
                  background: "#fff",
                  boxShadow: "0 4px 20px rgba(0,0,0,.4)",
                  outline:
                    pageIdx === activePage ? "2px solid #beffb6" : undefined,
                  outlineOffset: pageIdx === activePage ? 3 : undefined,
                  marginBottom: 24,
                  flexShrink: 0,
                }}
              >
                {/* Page number footer */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 30,
                    left: 0,
                    right: 0,
                    textAlign: "center",
                    fontSize: 10,
                    fontFamily: "Helvetica, Arial, sans-serif",
                    color: "#000",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  Page {pageIdx + 1} of {pages.length}
                </div>

                {pageComps.map((comp) => {
                  if (comp.type === "pagebreak") return null;
                  const isSelected = comp.id === selectedId;
                  const [rx, , rw, rh] = comp.rect;
                  const top = cssTop(comp.rect);

                  return (
                    <div
                      key={comp.id}
                      onMouseDown={(e) => startDrag(e, comp.id, pageIdx)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(comp.id);
                      }}
                      style={{
                        position: "absolute",
                        left: rx,
                        top,
                        width: rw,
                        height: rh,
                        cursor: "move",
                        overflow: "visible",
                        outline: isSelected
                          ? "2px solid #2196F3"
                          : "1px dashed #ccc",
                        boxShadow: isSelected
                          ? "0 0 0 3px rgba(33,150,243,.2)"
                          : undefined,
                      }}
                    >
                      {comp.type === "shape" ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: shapeToSvg(comp),
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            fontFamily: comp.style.font,
                            fontSize: comp.style.size,
                            fontWeight: comp.style.bold ? "bold" : "normal",
                            fontStyle: comp.style.italic ? "italic" : "normal",
                            textAlign: comp.style.align,
                            color: comp.style.color,
                            whiteSpace: "pre-wrap",
                            width: "100%",
                            height: "100%",
                          }}
                        >
                          {interpolate(comp.content, editorContext)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {comps.filter((c) => c.type !== "pagebreak").length === 0 && (
            <Text c="dimmed" size="sm" style={{ marginTop: 40 }}>
              Canvas is empty — add a Text or Shape component
            </Text>
          )}
        </div>

        {/* ── Right panel ────────────────────────────────────────────── */}
        <Paper
          withBorder
          radius={0}
          w={240}
          style={{
            borderRight: "none",
            borderTop: "none",
            borderBottom: "none",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Tabs
            defaultValue="inspector"
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="inspector" style={{ fontSize: 12 }}>
                Inspector
              </Tabs.Tab>
              <Tabs.Tab value="pages" style={{ fontSize: 12 }}>
                Pages
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="inspector" style={{ flex: 1, overflow: "auto" }}>
              <InspectorPanel
                comp={selectedComp}
                onChange={(patch) => {
                  if (selectedId)
                    dispatch({ type: "UPDATE_COMP", id: selectedId, patch });
                }}
              />
            </Tabs.Panel>

            <Tabs.Panel value="pages" style={{ flex: 1, overflow: "auto" }}>
              <PagesPanel
                pages={pages}
                activePage={activePage}
                onSwap={(i, j) => {
                  const next = swapPages(comps, i, j);
                  dispatch({ type: "SET_COMPS", comps: next });
                  setActivePage(j);
                }}
                onDelete={(idx) => {
                  const next = deletePage(comps, idx);
                  dispatch({ type: "SET_COMPS", comps: next });
                  if (
                    activePage >=
                    next.filter((c) => c.type !== "pagebreak").length
                  )
                    setActivePage(Math.max(0, activePage - 1));
                }}
                onNavigate={(idx) => {
                  setActivePage(idx);
                  const pageEl = canvasRef.current?.querySelector<HTMLElement>(
                    `[data-page="${idx}"]`,
                  );
                  pageEl?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
              />
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </div>
    </div>
  );
}

// ── Page management helpers ────────────────────────────────────────────────
function swapPages(comps: PdfComp[], i: number, j: number): PdfComp[] {
  const chunks: PdfComp[][] = [];
  const seps: PageBreakComp[] = [];
  let current: PdfComp[] = [];
  for (const c of comps) {
    if (c.type === "pagebreak") {
      chunks.push(current);
      seps.push(c);
      current = [];
    } else current.push(c);
  }
  chunks.push(current);
  [chunks[i], chunks[j]] = [chunks[j]!, chunks[i]!];
  const result: PdfComp[] = [];
  for (let k = 0; k < chunks.length; k++) {
    result.push(...chunks[k]!);
    if (k < seps.length) result.push(seps[k]!);
  }
  return result;
}

function deletePage(comps: PdfComp[], idx: number): PdfComp[] {
  const chunks: PdfComp[][] = [];
  const seps: PageBreakComp[] = [];
  let current: PdfComp[] = [];
  for (const c of comps) {
    if (c.type === "pagebreak") {
      chunks.push(current);
      seps.push(c);
      current = [];
    } else current.push(c);
  }
  chunks.push(current);
  if (chunks.length <= 1) return comps;
  chunks.splice(idx, 1);
  seps.splice(Math.min(idx, seps.length - 1), 1);
  const result: PdfComp[] = [];
  for (let k = 0; k < chunks.length; k++) {
    result.push(...chunks[k]!);
    if (k < seps.length) result.push(seps[k]!);
  }
  return result;
}

// ── Inspector panel ────────────────────────────────────────────────────────
interface InspectorPanelProps {
  comp: PdfComp | null;
  onChange: (patch: Partial<PdfComp>) => void;
}

function InspectorPanel({ comp, onChange }: InspectorPanelProps) {
  if (!comp || comp.type === "pagebreak") {
    return (
      <Text size="xs" c="dimmed" p="sm">
        Select a component to edit
      </Text>
    );
  }

  const patchRect = (idx: 0 | 1 | 2 | 3, val: number) => {
    const rect: Rect = [...comp.rect] as Rect;
    rect[idx] = val;
    onChange({ rect } as Partial<PdfComp>);
  };

  return (
    <Stack gap="xs" p="sm">
      <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
        {comp.id}
      </Text>

      <Text size="xs" fw={600}>
        Position
      </Text>
      <Group gap="xs">
        <NumberInput
          size="xs"
          label="X"
          value={comp.rect[0]}
          onChange={(v) => patchRect(0, Number(v))}
          w={80}
        />
        <NumberInput
          size="xs"
          label="Y"
          value={comp.rect[1]}
          onChange={(v) => patchRect(1, Number(v))}
          w={80}
        />
      </Group>
      <Group gap="xs">
        <NumberInput
          size="xs"
          label="W"
          value={comp.rect[2]}
          min={10}
          onChange={(v) => patchRect(2, Number(v))}
          w={80}
        />
        <NumberInput
          size="xs"
          label="H"
          value={comp.rect[3]}
          min={10}
          onChange={(v) => patchRect(3, Number(v))}
          w={80}
        />
      </Group>

      {comp.type === "text" && (
        <>
          <Text size="xs" fw={600} mt="xs">
            Content
          </Text>
          <Textarea
            size="xs"
            value={comp.content}
            placeholder="Text (supports {{variables}})"
            autosize
            minRows={2}
            maxRows={5}
            onChange={(e) =>
              onChange({ content: e.target.value } as Partial<PdfComp>)
            }
          />

          <Text size="xs" fw={600} mt="xs">
            Style
          </Text>
          <Select
            size="xs"
            label="Font"
            value={comp.style.font}
            data={["Helvetica", "Times-Roman", "Courier"]}
            onChange={(v) =>
              onChange({
                style: { ...comp.style, font: v ?? "Helvetica" },
              } as Partial<PdfComp>)
            }
          />
          <NumberInput
            size="xs"
            label="Size"
            value={comp.style.size}
            min={6}
            max={72}
            onChange={(v) =>
              onChange({
                style: { ...comp.style, size: Number(v) },
              } as Partial<PdfComp>)
            }
          />
          <Select
            size="xs"
            label="Align"
            value={comp.style.align}
            data={["left", "center", "right"]}
            onChange={(v) =>
              onChange({
                style: {
                  ...comp.style,
                  align: (v ?? "left") as "left" | "center" | "right",
                },
              } as Partial<PdfComp>)
            }
          />
          <ColorInput
            size="xs"
            label="Color"
            value={comp.style.color}
            onChange={(v) =>
              onChange({
                style: { ...comp.style, color: v },
              } as Partial<PdfComp>)
            }
          />
          <Group gap="sm">
            <Checkbox
              size="xs"
              label="Bold"
              checked={comp.style.bold}
              onChange={(e) =>
                onChange({
                  style: { ...comp.style, bold: e.target.checked },
                } as Partial<PdfComp>)
              }
            />
            <Checkbox
              size="xs"
              label="Italic"
              checked={comp.style.italic}
              onChange={(e) =>
                onChange({
                  style: { ...comp.style, italic: e.target.checked },
                } as Partial<PdfComp>)
              }
            />
          </Group>
        </>
      )}

      {comp.type === "shape" && (
        <>
          <Text size="xs" fw={600} mt="xs">
            Shape
          </Text>
          <Select
            size="xs"
            label="Type"
            value={comp.shape_type}
            data={["rect", "line", "circle"]}
            onChange={(v) =>
              onChange({
                shape_type: (v ?? "rect") as ShapeComp["shape_type"],
              } as Partial<PdfComp>)
            }
          />
          <ColorInput
            size="xs"
            label="Color"
            value={comp.color}
            onChange={(v) => onChange({ color: v } as Partial<PdfComp>)}
          />
          <NumberInput
            size="xs"
            label="Stroke width"
            value={comp.stroke_width}
            min={0.5}
            max={20}
            step={0.5}
            onChange={(v) =>
              onChange({ stroke_width: Number(v) } as Partial<PdfComp>)
            }
          />
          <Checkbox
            size="xs"
            label="Fill"
            checked={comp.fill}
            onChange={(e) =>
              onChange({ fill: e.target.checked } as Partial<PdfComp>)
            }
          />
        </>
      )}
    </Stack>
  );
}

// ── Pages panel ────────────────────────────────────────────────────────────
interface PagesPanelProps {
  pages: PdfComp[][];
  activePage: number;
  onSwap: (i: number, j: number) => void;
  onDelete: (idx: number) => void;
  onNavigate: (idx: number) => void;
}

function PagesPanel({
  pages,
  activePage,
  onSwap,
  onDelete,
  onNavigate,
}: PagesPanelProps) {
  return (
    <Stack gap="xs" p="sm">
      {pages.map((pageComps, idx) => (
        <Paper
          key={idx}
          withBorder
          p="xs"
          radius="sm"
          style={{
            cursor: "pointer",
            background:
              idx === activePage ? "var(--mantine-color-blue-0)" : undefined,
          }}
          onClick={() => onNavigate(idx)}
        >
          <Group justify="space-between" gap="xs">
            <div>
              <Text size="xs" fw={500}>
                Page {idx + 1}
              </Text>
              <Text size="xs" c="dimmed">
                {pageComps.length} component
                {pageComps.length !== 1 ? "s" : ""}
              </Text>
            </div>
            <Group gap={4}>
              <ActionIcon
                size="xs"
                variant="subtle"
                disabled={idx === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onSwap(idx, idx - 1);
                }}
              >
                ▲
              </ActionIcon>
              <ActionIcon
                size="xs"
                variant="subtle"
                disabled={idx === pages.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onSwap(idx, idx + 1);
                }}
              >
                ▼
              </ActionIcon>
              <ActionIcon
                size="xs"
                color="red"
                variant="subtle"
                disabled={pages.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    pageComps.length === 0 ||
                    confirm(
                      `Delete page ${idx + 1}? Its ${pageComps.length} component(s) will be removed.`,
                    )
                  )
                    onDelete(idx);
                }}
              >
                ✕
              </ActionIcon>
            </Group>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
