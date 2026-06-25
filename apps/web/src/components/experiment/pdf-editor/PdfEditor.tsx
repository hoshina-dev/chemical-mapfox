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
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import {
  calculateExperimentAction,
  generateReportAction,
  getReportDownloadUrlAction,
  getReportStatusAction,
} from "@/app/actions/experiment";
import {
  getExperimentPreviewContextAction,
  type PdfPreviewExperiment,
  savePdfTemplateAction,
} from "@/app/actions/pdf";
import { templatePdfPath } from "@/lib/experiment-manager/routes";

const CLIPBOARD_MARKER = "__pdf_editor_clipboard__";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
const MIN_SIZE = 10;
const GRID = 5;
const SNAP_THRESH = 5;
const HISTORY_LIMIT = 100;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;

// 8 resize handles, positioned as fractions of the component box.
const HANDLES: Array<{ dir: string; x: number; y: number; cursor: string }> = [
  { dir: "nw", x: 0, y: 0, cursor: "nwse-resize" },
  { dir: "n", x: 0.5, y: 0, cursor: "ns-resize" },
  { dir: "ne", x: 1, y: 0, cursor: "nesw-resize" },
  { dir: "e", x: 1, y: 0.5, cursor: "ew-resize" },
  { dir: "se", x: 1, y: 1, cursor: "nwse-resize" },
  { dir: "s", x: 0.5, y: 1, cursor: "ns-resize" },
  { dir: "sw", x: 0, y: 1, cursor: "nesw-resize" },
  { dir: "w", x: 0, y: 0.5, cursor: "ew-resize" },
];

// ── Helpers ────────────────────────────────────────────────────────────────
const VAR_RE = /\{\{(\w+)\}\}/g;

/** Render text with `{{var}}` resolution, highlighting unknown placeholders. */
function renderText(
  content: string,
  ctx: Record<string, unknown>,
  known: Set<string>,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  const re = new RegExp(VAR_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m.index > last) nodes.push(content.slice(last, m.index));
    const key = m[1]!;
    if (key in ctx) {
      nodes.push(String(ctx[key]));
    } else if (known.has(key)) {
      nodes.push(m[0]);
    } else {
      nodes.push(
        <span
          key={`u${i}`}
          style={{
            background: "#fff3bf",
            color: "#e8590c",
            borderRadius: 2,
          }}
        >
          {m[0]}
        </span>,
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < content.length) nodes.push(content.slice(last));
  return nodes;
}

function cssTop(rect: Rect): number {
  return PAGE_H - rect[1] - rect[3];
}

function snapToGrid(v: number): number {
  return Math.round(v / GRID) * GRID;
}

function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z * 100) / 100));
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

/** Remove editor-only fields so the saved payload matches the backend schema. */
function stripEditorFields(comps: PdfComp[]): PdfComp[] {
  return comps.map((c) => {
    if (c.type === "pagebreak" || c.locked === undefined) return c;
    const copy = { ...c };
    delete copy.locked;
    return copy;
  });
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

/** Snap a moving box to the grid and to other components' edges/centers. */
function computeSnap(
  comps: PdfComp[],
  x: number,
  y: number,
  w: number,
  h: number,
  pageIdx: number,
  selfId: string,
  gridOn: boolean,
): { x: number; y: number; guideX: number[]; guideY: number[] } {
  const { start, end } = getPageRange(comps, pageIdx);
  const gx: number[] = [PAGE_W / 2];
  const gy: number[] = [PAGE_H / 2];
  for (let i = start; i < end; i++) {
    const o = comps[i]!;
    if (o.type === "pagebreak" || o.id === selfId) continue;
    gx.push(o.rect[0], o.rect[0] + o.rect[2] / 2, o.rect[0] + o.rect[2]);
    const ot = cssTop(o.rect);
    gy.push(ot, ot + o.rect[3] / 2, ot + o.rect[3]);
  }

  const pick = (moving: number[], guides: number[]) => {
    let bestDelta: number | null = null;
    let bestAbs = SNAP_THRESH + 1;
    let line: number | null = null;
    for (const m of moving) {
      for (const g of guides) {
        const d = g - m;
        if (Math.abs(d) < bestAbs) {
          bestAbs = Math.abs(d);
          bestDelta = d;
          line = g;
        }
      }
    }
    return bestAbs <= SNAP_THRESH ? { delta: bestDelta!, line: line! } : null;
  };

  const guideX: number[] = [];
  const guideY: number[] = [];

  const sx = pick([x, x + w / 2, x + w], gx);
  if (sx) {
    x += sx.delta;
    guideX.push(sx.line);
  } else if (gridOn) {
    x = snapToGrid(x);
  }

  const sy = pick([y, y + h / 2, y + h], gy);
  if (sy) {
    y += sy.delta;
    guideY.push(sy.line);
  } else if (gridOn) {
    y = snapToGrid(y);
  }

  return { x, y, guideX, guideY };
}

/** Reorder a component within its own page (between page breaks). */
function reorderComp(
  comps: PdfComp[],
  id: string,
  mode: "front" | "back" | "forward" | "backward",
): PdfComp[] {
  const chunks: PdfComp[][] = [];
  const seps: PageBreakComp[] = [];
  let cur: PdfComp[] = [];
  for (const c of comps) {
    if (c.type === "pagebreak") {
      chunks.push(cur);
      seps.push(c);
      cur = [];
    } else cur.push(c);
  }
  chunks.push(cur);

  for (const chunk of chunks) {
    const i = chunk.findIndex((c) => c.id === id);
    if (i < 0) continue;
    const [item] = chunk.splice(i, 1);
    let t: number;
    if (mode === "back") t = 0;
    else if (mode === "front") t = chunk.length;
    else if (mode === "backward") t = Math.max(0, i - 1);
    else t = Math.min(chunk.length, i + 1);
    chunk.splice(t, 0, item!);
    break;
  }

  const result: PdfComp[] = [];
  for (let k = 0; k < chunks.length; k++) {
    result.push(...chunks[k]!);
    if (k < seps.length) result.push(seps[k]!);
  }
  return result;
}

type AlignMode =
  | "left"
  | "hcenter"
  | "right"
  | "top"
  | "vmiddle"
  | "bottom";

/** Align the given components (page-relative coords) to a shared edge/center. */
function alignRects(
  comps: PdfComp[],
  ids: string[],
  mode: AlignMode,
): Record<string, Rect> {
  const sel = comps.filter(
    (c): c is TextComp | ShapeComp =>
      c.type !== "pagebreak" && ids.includes(c.id),
  );
  if (sel.length < 2) return {};
  const lefts = sel.map((c) => c.rect[0]);
  const rights = sel.map((c) => c.rect[0] + c.rect[2]);
  const bottoms = sel.map((c) => c.rect[1]);
  const tops = sel.map((c) => c.rect[1] + c.rect[3]);
  const minL = Math.min(...lefts);
  const maxR = Math.max(...rights);
  const minB = Math.min(...bottoms);
  const maxT = Math.max(...tops);
  const cx = (minL + maxR) / 2;
  const cy = (minB + maxT) / 2;

  const out: Record<string, Rect> = {};
  for (const c of sel) {
    const [x, y, w, h] = c.rect;
    let nx = x;
    let ny = y;
    if (mode === "left") nx = minL;
    else if (mode === "right") nx = maxR - w;
    else if (mode === "hcenter") nx = Math.round(cx - w / 2);
    else if (mode === "bottom") ny = minB;
    else if (mode === "top") ny = maxT - h;
    else if (mode === "vmiddle") ny = Math.round(cy - h / 2);
    out[c.id] = [Math.round(nx), Math.round(ny), w, h];
  }
  return out;
}

/** Evenly distribute the gaps between components along one axis. */
function distributeRects(
  comps: PdfComp[],
  ids: string[],
  axis: "x" | "y",
): Record<string, Rect> {
  const sel = comps.filter(
    (c): c is TextComp | ShapeComp =>
      c.type !== "pagebreak" && ids.includes(c.id),
  );
  if (sel.length < 3) return {};
  const dim = axis === "x" ? 2 : 0; // width or (pdf-y) for size along axis
  const pos = axis === "x" ? 0 : 1;
  const sorted = [...sel].sort((a, b) => a.rect[pos] - b.rect[pos]);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const start = first.rect[pos];
  const end = last.rect[pos] + last.rect[dim];
  const totalSize = sorted.reduce((sum, c) => sum + c.rect[dim], 0);
  const gap = (end - start - totalSize) / (sorted.length - 1);

  const out: Record<string, Rect> = {};
  let cursor = start;
  for (const c of sorted) {
    const rect: Rect = [...c.rect] as Rect;
    rect[pos] = Math.round(cursor);
    out[c.id] = rect;
    cursor += c.rect[dim] + gap;
  }
  return out;
}

/** Clone components for pasting: fresh ids + a small offset, clamped to page. */
function clonesForPaste(comps: Array<TextComp | ShapeComp>): Array<
  TextComp | ShapeComp
> {
  const stamp = Date.now();
  return comps.map((c, i) => {
    const rect: Rect = [
      Math.min(c.rect[0] + 10, PAGE_W - c.rect[2]),
      Math.max(c.rect[1] - 10, 0),
      c.rect[2],
      c.rect[3],
    ];
    const id = `${c.type}_${stamp}_${i}`;
    return c.type === "text"
      ? { ...c, id, rect, style: { ...c.style } }
      : { ...c, id, rect };
  });
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
  | { type: "ADD_COMPS"; comps: PdfComp[]; insertAt: number }
  | { type: "UPDATE_COMP"; id: string; patch: Partial<PdfComp> }
  | { type: "DELETE_COMP"; id: string }
  | { type: "DELETE_MANY"; ids: string[] }
  | { type: "MOVE_RECT"; id: string; x: number; y: number }
  | { type: "SET_RECT"; id: string; rect: Rect }
  | { type: "SET_RECTS"; rects: Record<string, Rect> };

function compsReducer(state: PdfComp[], action: Action): PdfComp[] {
  switch (action.type) {
    case "SET_COMPS":
      return action.comps;
    case "ADD_COMP": {
      const next = [...state];
      next.splice(action.insertAt, 0, action.comp);
      return next;
    }
    case "ADD_COMPS": {
      const next = [...state];
      next.splice(action.insertAt, 0, ...action.comps);
      return next;
    }
    case "UPDATE_COMP":
      return state.map((c) =>
        c.id === action.id ? ({ ...c, ...action.patch } as PdfComp) : c,
      );
    case "DELETE_COMP":
      return state.filter((c) => c.id !== action.id);
    case "DELETE_MANY": {
      const drop = new Set(action.ids);
      return state.filter((c) => !drop.has(c.id));
    }
    case "MOVE_RECT":
      return state.map((c) => {
        if (c.id !== action.id || c.type === "pagebreak") return c;
        const rect: Rect = [action.x, action.y, c.rect[2], c.rect[3]];
        return { ...c, rect };
      });
    case "SET_RECT":
      return state.map((c) => {
        if (c.id !== action.id || c.type === "pagebreak") return c;
        return { ...c, rect: action.rect };
      });
    case "SET_RECTS":
      return state.map((c) => {
        if (c.type === "pagebreak") return c;
        const rect = action.rects[c.id];
        return rect ? { ...c, rect } : c;
      });
    default:
      return state;
  }
}

// ── History reducer (undo/redo) ────────────────────────────────────────────
interface HistoryState {
  past: PdfComp[][];
  present: PdfComp[];
  future: PdfComp[][];
}

type HistoryAction =
  | { type: "COMMIT"; action: Action }
  | { type: "BEGIN" }
  | { type: "LIVE"; action: Action }
  | { type: "UNDO" }
  | { type: "REDO" };

function pushPast(past: PdfComp[][], present: PdfComp[]): PdfComp[][] {
  const next = [...past, present];
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}

function historyReducer(
  state: HistoryState,
  ha: HistoryAction,
): HistoryState {
  switch (ha.type) {
    case "COMMIT": {
      const present = compsReducer(state.present, ha.action);
      if (present === state.present) return state;
      return { past: pushPast(state.past, state.present), present, future: [] };
    }
    case "BEGIN":
      return {
        past: pushPast(state.past, state.present),
        present: state.present,
        future: [],
      };
    case "LIVE":
      return { ...state, present: compsReducer(state.present, ha.action) };
    case "UNDO": {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1]!;
      return {
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future],
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0]!;
      return {
        past: pushPast(state.past, state.present),
        present: next,
        future: state.future.slice(1),
      };
    }
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
  const [hist, hd] = useReducer(historyReducer, undefined, () => ({
    past: [],
    present: initialComponents,
    future: [],
  }));
  const comps = hist.present;
  const canUndo = hist.past.length > 0;
  const canRedo = hist.future.length > 0;

  const commit = useCallback((action: Action) => hd({ type: "COMMIT", action }), []);
  const undo = useCallback(() => hd({ type: "UNDO" }), []);
  const redo = useCallback(() => hd({ type: "REDO" }), []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [guides, setGuides] = useState<{
    page: number;
    x: number[];
    y: number[];
  } | null>(null);
  const [varSearch, setVarSearch] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMsg, setPdfMsg] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [marquee, setMarquee] = useState<{
    page: number;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    pageIdx: number;
    offsetX: number;
    offsetY: number;
    committed: boolean;
    group?: {
      bases: Array<{ id: string; left: number; top: number; w: number; h: number }>;
      box: { left: number; top: number; w: number; h: number };
      startX: number;
      startY: number;
    };
  } | null>(null);
  const marqueeRef = useRef<{
    pageIdx: number;
    startX: number;
    startY: number;
  } | null>(null);
  const marqueeRectRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const clipboardRef = useRef<Array<TextComp | ShapeComp>>([]);
  const resizeRef = useRef<{
    id: string;
    pageIdx: number;
    dir: string;
    startX: number;
    startY: number;
    startCss: { left: number; top: number; w: number; h: number };
    committed: boolean;
  } | null>(null);

  // Refs so the pointer effect can subscribe once without going stale.
  // Kept in sync via an effect (updating refs during render is disallowed).
  const compsRef = useRef(comps);
  const zoomRef = useRef(zoom);
  const snapRef = useRef(snap);
  const selectedIdRef = useRef(selectedId);
  const selectedIdsRef = useRef(selectedIds);
  const activePageRef = useRef(activePage);

  // Inspector content textarea, for inserting variables at the cursor.
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const contentSelRef = useRef<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  // Dirty tracking (compares against the last saved snapshot, editor-only
  // fields stripped so lock toggles don't count as changes).
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(stripEditorFields(initialComponents)),
  );
  const dirty = JSON.stringify(stripEditorFields(comps)) !== savedSnapshot;
  const dirtyRef = useRef(dirty);

  useEffect(() => {
    compsRef.current = comps;
    zoomRef.current = zoom;
    snapRef.current = snap;
    selectedIdRef.current = selectedId;
    selectedIdsRef.current = selectedIds;
    activePageRef.current = activePage;
    dirtyRef.current = dirty;
  });

  // ── Selection helpers ────────────────────────────────────────────────────
  const selectOnly = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedIds([id]);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      setSelectedId(has ? (next[next.length - 1] ?? null) : id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setSelectedIds([]);
  }, []);

  const knownVars = useMemo(() => {
    const set = new Set<string>();
    for (const g of variableGroups) for (const v of g.variables) set.add(v.id);
    return set;
  }, [variableGroups]);

  const pageOf = useMemo(() => {
    const m = new Map<string, number>();
    let p = 0;
    for (const c of comps) {
      if (c.type === "pagebreak") p++;
      else m.set(c.id, p);
    }
    return m;
  }, [comps]);

  const onExperimentSelect = useCallback(async (expId: string | null) => {
    setSelectedExpId(expId);
    if (!expId) {
      setEditorContext({});
      return;
    }
    const result = await getExperimentPreviewContextAction(expId);
    setEditorContext(result.success ? result.data : {});
  }, []);

  // ── Drag / resize start ──────────────────────────────────────────────────
  const startDrag = useCallback(
    (e: React.MouseEvent, id: string, pageIdx: number) => {
      e.preventDefault();
      e.stopPropagation();
      const comp = compsRef.current.find((c) => c.id === id);
      if (!comp || comp.type === "pagebreak") return;

      // Shift/Cmd-click toggles membership without starting a drag.
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        toggleSelect(id);
        return;
      }

      const selected = selectedIdsRef.current;
      const isGroup = selected.includes(id) && selected.length > 1;
      const pageEl = canvasRef.current?.querySelector<HTMLElement>(
        `[data-page="${pageIdx}"]`,
      );
      if (!pageEl) return;
      const rect = pageEl.getBoundingClientRect();
      const z = zoomRef.current;

      if (isGroup) {
        const onPage = new Set<string>();
        const { start, end } = getPageRange(compsRef.current, pageIdx);
        for (let i = start; i < end; i++) {
          const o = compsRef.current[i];
          if (o && o.type !== "pagebreak") onPage.add(o.id);
        }
        const bases = compsRef.current
          .filter(
            (c): c is TextComp | ShapeComp =>
              c.type !== "pagebreak" &&
              selected.includes(c.id) &&
              !c.locked &&
              onPage.has(c.id),
          )
          .map((c) => ({
            id: c.id,
            left: c.rect[0],
            top: cssTop(c.rect),
            w: c.rect[2],
            h: c.rect[3],
          }));
        if (bases.length > 0) {
          const minL = Math.min(...bases.map((b) => b.left));
          const minT = Math.min(...bases.map((b) => b.top));
          const maxR = Math.max(...bases.map((b) => b.left + b.w));
          const maxB = Math.max(...bases.map((b) => b.top + b.h));
          dragRef.current = {
            id,
            pageIdx,
            offsetX: 0,
            offsetY: 0,
            committed: false,
            group: {
              bases,
              box: { left: minL, top: minT, w: maxR - minL, h: maxB - minT },
              startX: e.clientX,
              startY: e.clientY,
            },
          };
        }
        setActivePage(pageIdx);
        return;
      }

      if (comp.locked) {
        selectOnly(id);
        setActivePage(pageIdx);
        return;
      }

      selectOnly(id);
      dragRef.current = {
        id,
        pageIdx,
        offsetX: (e.clientX - rect.left) / z - comp.rect[0],
        offsetY: (e.clientY - rect.top) / z - cssTop(comp.rect),
        committed: false,
      };
      setActivePage(pageIdx);
    },
    [toggleSelect, selectOnly],
  );

  const startResize = useCallback(
    (e: React.MouseEvent, id: string, pageIdx: number, dir: string) => {
      e.preventDefault();
      e.stopPropagation();
      const comp = compsRef.current.find((c) => c.id === id);
      if (!comp || comp.type === "pagebreak" || comp.locked) return;
      resizeRef.current = {
        id,
        pageIdx,
        dir,
        startX: e.clientX,
        startY: e.clientY,
        startCss: {
          left: comp.rect[0],
          top: cssTop(comp.rect),
          w: comp.rect[2],
          h: comp.rect[3],
        },
        committed: false,
      };
      selectOnly(id);
    },
    [selectOnly],
  );

  // Marquee (rubber-band) selection starting on empty page background.
  const startMarquee = useCallback(
    (e: React.MouseEvent, pageIdx: number) => {
      if (e.shiftKey || e.metaKey || e.ctrlKey) return;
      const pageEl = canvasRef.current?.querySelector<HTMLElement>(
        `[data-page="${pageIdx}"]`,
      );
      if (!pageEl) return;
      const rect = pageEl.getBoundingClientRect();
      const z = zoomRef.current;
      marqueeRef.current = {
        pageIdx,
        startX: (e.clientX - rect.left) / z,
        startY: (e.clientY - rect.top) / z,
      };
      setActivePage(pageIdx);
    },
    [],
  );

  // ── Global pointer handlers (drag + resize + marquee), subscribed once ────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const resize = resizeRef.current;
      if (resize) {
        const comp = compsRef.current.find((c) => c.id === resize.id);
        if (!comp || comp.type === "pagebreak") return;
        const z = zoomRef.current;
        const dx = (e.clientX - resize.startX) / z;
        const dy = (e.clientY - resize.startY) / z;
        let { left, top, w, h } = resize.startCss;
        const right = left + w;
        const bottom = top + h;
        if (resize.dir.includes("e")) w = w + dx;
        if (resize.dir.includes("s")) h = h + dy;
        if (resize.dir.includes("w")) {
          left = left + dx;
          w = w - dx;
        }
        if (resize.dir.includes("n")) {
          top = top + dy;
          h = h - dy;
        }
        if (w < MIN_SIZE) {
          if (resize.dir.includes("w")) left = right - MIN_SIZE;
          w = MIN_SIZE;
        }
        if (h < MIN_SIZE) {
          if (resize.dir.includes("n")) top = bottom - MIN_SIZE;
          h = MIN_SIZE;
        }
        if (snapRef.current) {
          left = snapToGrid(left);
          top = snapToGrid(top);
          w = snapToGrid(w);
          h = snapToGrid(h);
        }
        left = Math.max(0, Math.min(left, PAGE_W - w));
        top = Math.max(0, Math.min(top, PAGE_H - h));
        const rect: Rect = [
          Math.round(left),
          Math.round(PAGE_H - top - h),
          Math.round(w),
          Math.round(h),
        ];
        if (!resize.committed) {
          hd({ type: "BEGIN" });
          resize.committed = true;
        }
        hd({ type: "LIVE", action: { type: "SET_RECT", id: resize.id, rect } });
        return;
      }

      const mq = marqueeRef.current;
      if (mq) {
        const pageEl = canvasRef.current?.querySelector<HTMLElement>(
          `[data-page="${mq.pageIdx}"]`,
        );
        if (!pageEl) return;
        const r = pageEl.getBoundingClientRect();
        const z = zoomRef.current;
        const curX = (e.clientX - r.left) / z;
        const curY = (e.clientY - r.top) / z;
        const x = Math.max(0, Math.min(mq.startX, curX));
        const y = Math.max(0, Math.min(mq.startY, curY));
        const w = Math.min(PAGE_W, Math.max(mq.startX, curX)) - x;
        const h = Math.min(PAGE_H, Math.max(mq.startY, curY)) - y;
        marqueeRectRef.current = { x, y, w, h };
        setMarquee({ page: mq.pageIdx, x, y, w, h });
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;
      const z = zoomRef.current;

      // Group drag: move all selected (draggable) components by one delta.
      if (drag.group) {
        const g = drag.group;
        let dx = (e.clientX - g.startX) / z;
        let dy = (e.clientY - g.startY) / z;
        dx = Math.max(-g.box.left, Math.min(dx, PAGE_W - (g.box.left + g.box.w)));
        dy = Math.max(-g.box.top, Math.min(dy, PAGE_H - (g.box.top + g.box.h)));
        if (snapRef.current) {
          dx = snapToGrid(dx);
          dy = snapToGrid(dy);
        }
        const rects: Record<string, Rect> = {};
        for (const b of g.bases) {
          const left = b.left + dx;
          const top = b.top + dy;
          rects[b.id] = [
            Math.round(left),
            Math.round(PAGE_H - top - b.h),
            b.w,
            b.h,
          ];
        }
        if (!drag.committed) {
          hd({ type: "BEGIN" });
          drag.committed = true;
        }
        hd({ type: "LIVE", action: { type: "SET_RECTS", rects } });
        return;
      }

      const comp = compsRef.current.find((c) => c.id === drag.id);
      if (!comp || comp.type === "pagebreak") return;
      const pageEl = canvasRef.current?.querySelector<HTMLElement>(
        `[data-page="${drag.pageIdx}"]`,
      );
      if (!pageEl) return;
      const rect = pageEl.getBoundingClientRect();
      const w = comp.rect[2];
      const h = comp.rect[3];
      let cssX = Math.max(
        0,
        Math.min((e.clientX - rect.left) / z - drag.offsetX, PAGE_W - w),
      );
      let cssY = Math.max(
        0,
        Math.min((e.clientY - rect.top) / z - drag.offsetY, PAGE_H - h),
      );
      const snapped = computeSnap(
        compsRef.current,
        cssX,
        cssY,
        w,
        h,
        drag.pageIdx,
        drag.id,
        snapRef.current,
      );
      cssX = snapped.x;
      cssY = snapped.y;
      setGuides({ page: drag.pageIdx, x: snapped.guideX, y: snapped.guideY });
      if (!drag.committed) {
        hd({ type: "BEGIN" });
        drag.committed = true;
      }
      const y = Math.round(PAGE_H - cssY - h);
      hd({
        type: "LIVE",
        action: { type: "MOVE_RECT", id: drag.id, x: Math.round(cssX), y },
      });
    };
    const onUp = () => {
      // Finalize a marquee selection by selecting intersecting components.
      const mq = marqueeRef.current;
      if (mq) {
        marqueeRef.current = null;
        const m = marqueeRectRef.current;
        marqueeRectRef.current = null;
        setMarquee(null);
        if (m && m.w > 2 && m.h > 2) {
          const { start, end } = getPageRange(compsRef.current, mq.pageIdx);
          const hits: string[] = [];
          for (let i = start; i < end; i++) {
            const c = compsRef.current[i];
            if (!c || c.type === "pagebreak") continue;
            const left = c.rect[0];
            const topc = cssTop(c.rect);
            const right = left + c.rect[2];
            const bottom = topc + c.rect[3];
            const overlap =
              left < m.x + m.w &&
              right > m.x &&
              topc < m.y + m.h &&
              bottom > m.y;
            if (overlap) hits.push(c.id);
          }
          setSelectedIds(hits);
          setSelectedId(hits[hits.length - 1] ?? null);
        } else {
          // A plain click on empty page area clears the selection.
          setSelectedId(null);
          setSelectedIds([]);
        }
      }
      dragRef.current = null;
      resizeRef.current = null;
      setGuides(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ── Add / delete / duplicate ─────────────────────────────────────────────
  const addText = () => {
    const { end } = getPageRange(comps, activePage);
    const comp = newTextComp();
    commit({ type: "ADD_COMP", comp, insertAt: end });
    selectOnly(comp.id);
  };

  const addShape = () => {
    const { end } = getPageRange(comps, activePage);
    const comp = newShapeComp();
    commit({ type: "ADD_COMP", comp, insertAt: end });
    selectOnly(comp.id);
  };

  const addPageBreak = () => {
    const { end } = getPageRange(comps, activePage);
    commit({ type: "ADD_COMP", comp: newPageBreak(), insertAt: end });
  };

  const deleteSelected = useCallback(() => {
    const ids = selectedIdsRef.current;
    if (ids.length === 0) return;
    commit({ type: "DELETE_MANY", ids });
    clearSelection();
  }, [commit, clearSelection]);

  const duplicateSelected = useCallback(() => {
    const ids = selectedIdsRef.current;
    const sel = compsRef.current.filter(
      (c): c is TextComp | ShapeComp =>
        c.type !== "pagebreak" && ids.includes(c.id),
    );
    if (sel.length === 0) return;
    const lastIdx = Math.max(
      ...sel.map((c) => compsRef.current.findIndex((x) => x.id === c.id)),
    );
    const clones = clonesForPaste(sel);
    commit({ type: "ADD_COMPS", comps: clones, insertAt: lastIdx + 1 });
    setSelectedIds(clones.map((c) => c.id));
    setSelectedId(clones[clones.length - 1]?.id ?? null);
  }, [commit]);

  const nudge = useCallback(
    (key: string, step: number) => {
      const ids = selectedIdsRef.current;
      if (ids.length === 0) return;
      let dx = 0;
      let dy = 0;
      if (key === "ArrowLeft") dx = -step;
      else if (key === "ArrowRight") dx = step;
      else if (key === "ArrowUp") dy = step;
      else if (key === "ArrowDown") dy = -step;
      const rects: Record<string, Rect> = {};
      for (const c of compsRef.current) {
        if (c.type === "pagebreak" || !ids.includes(c.id)) continue;
        const x = Math.max(0, Math.min(c.rect[0] + dx, PAGE_W - c.rect[2]));
        const y = Math.max(0, Math.min(c.rect[1] + dy, PAGE_H - c.rect[3]));
        rects[c.id] = [x, y, c.rect[2], c.rect[3]];
      }
      commit({ type: "SET_RECTS", rects });
    },
    [commit],
  );

  const alignSelected = useCallback(
    (mode: AlignMode) => {
      const rects = alignRects(compsRef.current, selectedIdsRef.current, mode);
      if (Object.keys(rects).length) commit({ type: "SET_RECTS", rects });
    },
    [commit],
  );

  const distributeSelected = useCallback(
    (axis: "x" | "y") => {
      const rects = distributeRects(
        compsRef.current,
        selectedIdsRef.current,
        axis,
      );
      if (Object.keys(rects).length) commit({ type: "SET_RECTS", rects });
    },
    [commit],
  );

  // ── Clipboard (copy/paste/cut, also across templates via the OS clipboard) ─
  const copySelection = useCallback(async () => {
    const ids = selectedIdsRef.current;
    const sel = compsRef.current.filter(
      (c): c is TextComp | ShapeComp =>
        c.type !== "pagebreak" && ids.includes(c.id),
    );
    if (sel.length === 0) return;
    clipboardRef.current = sel;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ [CLIPBOARD_MARKER]: true, comps: sel }),
      );
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the in-memory
      // fallback still enables same-session paste.
    }
  }, []);

  const paste = useCallback(async () => {
    let items: Array<TextComp | ShapeComp> = clipboardRef.current;
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text) as {
        [CLIPBOARD_MARKER]?: boolean;
        comps?: Array<TextComp | ShapeComp>;
      };
      if (parsed?.[CLIPBOARD_MARKER] && Array.isArray(parsed.comps)) {
        items = parsed.comps;
      }
    } catch {
      // Not JSON / no permission — fall back to the in-memory clipboard.
    }
    if (!items || items.length === 0) return;
    const clones = clonesForPaste(items);
    const { end } = getPageRange(compsRef.current, activePageRef.current);
    commit({ type: "ADD_COMPS", comps: clones, insertAt: end });
    setSelectedIds(clones.map((c) => c.id));
    setSelectedId(clones[clones.length - 1]?.id ?? null);
  }, [commit]);

  const cutSelection = useCallback(async () => {
    await copySelection();
    const ids = selectedIdsRef.current;
    if (ids.length) {
      commit({ type: "DELETE_MANY", ids });
      clearSelection();
    }
  }, [copySelection, commit, clearSelection]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    const payload = stripEditorFields(compsRef.current);
    const result = await savePdfTemplateAction(
      sampleId,
      lineageId,
      payload,
      templateId,
    );
    setSaving(false);
    if (!result.success) {
      setSaveMsg({ text: result.error, ok: false });
      return;
    }
    setSavedSnapshot(JSON.stringify(payload));
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
  }, [sampleId, lineageId, templateId, router]);

  // ── Real PDF preview (render the saved layout for a chosen experiment) ─────
  const openRealPdf = useCallback(async () => {
    const expId = selectedExpId;
    if (!expId) return;
    setPdfBusy(true);
    setPdfMsg(null);
    // The render engine works off the saved template, so persist first.
    const payload = stripEditorFields(compsRef.current);
    const saved = await savePdfTemplateAction(
      sampleId,
      lineageId,
      payload,
      templateId,
    );
    if (!saved.success) {
      setPdfMsg({ text: saved.error, ok: false });
      setPdfBusy(false);
      return;
    }
    setSavedSnapshot(JSON.stringify(payload));
    await calculateExperimentAction(expId);
    await generateReportAction(expId);
    let url: string | null = null;
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const st = await getReportStatusAction(expId);
      if (!st.success) continue;
      const s = (st.data.status ?? "").toLowerCase();
      if (s.includes("fail") || s.includes("error")) {
        setPdfMsg({ text: "Report generation failed", ok: false });
        setPdfBusy(false);
        return;
      }
      const done =
        Boolean(st.data.generatedAt) ||
        s.includes("succ") ||
        s.includes("complete") ||
        s.includes("ready") ||
        s.includes("done");
      if (done) {
        const dl = await getReportDownloadUrlAction(expId);
        if (dl.success) {
          url = dl.data.url;
          break;
        }
      }
    }
    setPdfBusy(false);
    if (url) {
      window.open(url, "_blank", "noopener");
      setPdfMsg({ text: "Opened PDF", ok: true });
      setTimeout(() => setPdfMsg(null), 2500);
    } else {
      setPdfMsg({ text: "Timed out waiting for the PDF", ok: false });
    }
  }, [selectedExpId, sampleId, lineageId, templateId]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName ?? "").toLowerCase();
      const typing =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        Boolean(t?.isContentEditable);
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (meta && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (meta && key === "s") {
        e.preventDefault();
        void save();
        return;
      }
      if (meta && key === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      if (typing) return;

      if (meta && key === "c") {
        e.preventDefault();
        void copySelection();
        return;
      }
      if (meta && key === "x") {
        e.preventDefault();
        void cutSelection();
        return;
      }
      if (meta && key === "v") {
        e.preventDefault();
        void paste();
        return;
      }
      if (meta && key === "a") {
        e.preventDefault();
        const ids = compsRef.current
          .filter((c) => c.type !== "pagebreak")
          .map((c) => c.id);
        setSelectedIds(ids);
        setSelectedId(ids[ids.length - 1] ?? null);
        return;
      }

      if (e.key === "Escape") {
        clearSelection();
        return;
      }
      if (selectedIdsRef.current.length === 0) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        nudge(e.key, e.shiftKey ? 10 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    undo,
    redo,
    save,
    duplicateSelected,
    deleteSelected,
    nudge,
    copySelection,
    cutSelection,
    paste,
    clearSelection,
  ]);

  // ── Warn on unload when there are unsaved changes ────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ── Canvas scroll → active page ──────────────────────────────────────────
  const onScroll = () => {
    const container = canvasRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    let bestPage = activePage,
      bestVisible = 0;
    container.querySelectorAll<HTMLElement>("[data-page]").forEach((el) => {
      const r = el.getBoundingClientRect();
      const visible = Math.max(
        0,
        Math.min(r.bottom, cr.bottom) - Math.max(r.top, cr.top),
      );
      if (visible > bestVisible) {
        bestVisible = visible;
        bestPage = parseInt(el.dataset.page!);
      }
    });
    if (bestPage !== activePage) setActivePage(bestPage);
  };

  const scrollToComp = (id: string) => {
    const p = pageOf.get(id);
    if (p == null) return;
    setActivePage(p);
    selectOnly(id);
    canvasRef.current
      ?.querySelector<HTMLElement>(`[data-page="${p}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectedComp = selectedId
    ? (comps.find((c) => c.id === selectedId) ?? null)
    : null;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const multiSelected = selectedIds.length > 1;
  const pages = splitPages(comps);

  // ── Variables: copy or insert into selected text component ────────────────
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const copyVar = (varId: string) => {
    navigator.clipboard.writeText(`{{${varId}}}`).then(() => {
      setCopiedVar(varId);
      setTimeout(() => setCopiedVar(null), 1500);
    });
  };

  const insertVar = (varId: string) => {
    const comp = selectedComp;
    if (!comp || comp.type !== "text") return false;
    const token = `{{${varId}}}`;
    const { start, end } = contentSelRef.current;
    const content = comp.content;
    const next = content.slice(0, start) + token + content.slice(end);
    commit({ type: "UPDATE_COMP", id: comp.id, patch: { content: next } });
    const caret = start + token.length;
    contentSelRef.current = { start: caret, end: caret };
    requestAnimationFrame(() => {
      const el = contentRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
    return true;
  };

  const onVarClick = (varId: string) => {
    if (!insertVar(varId)) copyVar(varId);
  };

  const filteredGroups = useMemo(() => {
    const q = varSearch.trim().toLowerCase();
    if (!q) return variableGroups;
    return variableGroups
      .map((g) => ({
        ...g,
        variables: g.variables.filter(
          (v) =>
            v.label.toLowerCase().includes(q) ||
            v.id.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.variables.length > 0);
  }, [variableGroups, varSearch]);

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
            variant="default"
            onClick={() => void copySelection()}
            disabled={selectedIds.length === 0}
          >
            Copy
          </Button>
          <Button size="xs" variant="default" onClick={() => void paste()}>
            Paste
          </Button>
          <Button
            size="xs"
            variant="default"
            onClick={duplicateSelected}
            disabled={selectedIds.length === 0}
          >
            Duplicate
          </Button>
          <Button
            size="xs"
            color="red"
            variant="light"
            onClick={deleteSelected}
            disabled={selectedIds.length === 0}
          >
            Delete{selectedIds.length > 1 ? ` (${selectedIds.length})` : ""}
          </Button>

          <Group gap={2} wrap="nowrap">
            <Tooltip label="Undo (Ctrl/Cmd+Z)" withArrow>
              <ActionIcon
                variant="default"
                size="md"
                onClick={undo}
                disabled={!canUndo}
                aria-label="Undo"
              >
                ↶
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Redo (Ctrl/Cmd+Shift+Z)" withArrow>
              <ActionIcon
                variant="default"
                size="md"
                onClick={redo}
                disabled={!canRedo}
                aria-label="Redo"
              >
                ↷
              </ActionIcon>
            </Tooltip>
          </Group>

          <Group gap={2} wrap="nowrap">
            <Tooltip label="Zoom out" withArrow>
              <ActionIcon
                variant="default"
                size="md"
                onClick={() => setZoom((z) => clampZoom(z - 0.1))}
                aria-label="Zoom out"
              >
                −
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Reset zoom" withArrow>
              <Button
                size="xs"
                variant="default"
                w={52}
                px={4}
                onClick={() => setZoom(1)}
              >
                {Math.round(zoom * 100)}%
              </Button>
            </Tooltip>
            <Tooltip label="Zoom in" withArrow>
              <ActionIcon
                variant="default"
                size="md"
                onClick={() => setZoom((z) => clampZoom(z + 0.1))}
                aria-label="Zoom in"
              >
                +
              </ActionIcon>
            </Tooltip>
          </Group>

          <Checkbox
            size="xs"
            label="Snap"
            checked={snap}
            onChange={(e) => setSnap(e.target.checked)}
          />

          <div style={{ flex: 1 }} />

          {dirty && (
            <Badge color="yellow" variant="light">
              Unsaved changes
            </Badge>
          )}

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
          {previewMode === "experiment" && (
            <Tooltip
              label="Save, render, and open the real generated PDF for this experiment"
              withArrow
            >
              <Button
                size="xs"
                variant="default"
                loading={pdfBusy}
                disabled={!selectedExpId}
                onClick={() => void openRealPdf()}
              >
                Open real PDF
              </Button>
            </Tooltip>
          )}
          {pdfMsg && (
            <Badge color={pdfMsg.ok ? "green" : "red"} variant="light">
              {pdfMsg.text}
            </Badge>
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
                  Click to insert into a selected text box, else copy{" "}
                  <code>{"{{name}}"}</code>
                </Text>
                <TextInput
                  size="xs"
                  placeholder="Search variables…"
                  value={varSearch}
                  onChange={(e) => setVarSearch(e.currentTarget.value)}
                  mb={6}
                />
                {filteredGroups.length === 0 && (
                  <Text size="xs" c="dimmed">
                    No matches
                  </Text>
                )}
                {filteredGroups.map((group) => (
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
                            onClick={() => onVarClick(v.id)}
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
                        onClick={(e) => {
                          if (e.shiftKey || e.metaKey || e.ctrlKey)
                            toggleSelect(c.id);
                          else scrollToComp(c.id);
                        }}
                        style={{
                          cursor: "pointer",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 11,
                          background: selectedSet.has(c.id)
                            ? c.id === selectedId
                              ? "var(--mantine-color-blue-2)"
                              : "var(--mantine-color-blue-1)"
                            : "var(--mantine-color-default-hover)",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Text
                          size="xs"
                          c="blue"
                          style={{ fontFamily: "monospace" }}
                        >
                          {c.type === "shape" ? c.shape_type : "text"}
                        </Text>
                        <Text
                          size="xs"
                          c="dimmed"
                          style={{
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.type === "text" && c.content
                            ? c.content.slice(0, 14)
                            : c.id.slice(0, 12)}
                        </Text>
                        <Badge size="xs" variant="light" color="gray">
                          p{(pageOf.get(c.id) ?? 0) + 1}
                        </Badge>
                        <Tooltip
                          label={c.locked ? "Unlock" : "Lock"}
                          withArrow
                        >
                          <ActionIcon
                            size="xs"
                            variant={c.locked ? "filled" : "subtle"}
                            color={c.locked ? "orange" : "gray"}
                            onClick={(e) => {
                              e.stopPropagation();
                              commit({
                                type: "UPDATE_COMP",
                                id: c.id,
                                patch: { locked: !c.locked },
                              });
                            }}
                            aria-label={c.locked ? "Unlock" : "Lock"}
                          >
                            {c.locked ? "L" : "·"}
                          </ActionIcon>
                        </Tooltip>
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
          onClick={clearSelection}
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
            <div key={pageIdx} style={{ marginBottom: 24 }}>
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
                style={{
                  position: "relative",
                  width: PAGE_W * zoom,
                  height: PAGE_H * zoom,
                  flexShrink: 0,
                }}
              >
                <div
                  data-page={pageIdx}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => startMarquee(e, pageIdx)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: PAGE_W,
                    height: PAGE_H,
                    background: "#fff",
                    boxShadow: "0 4px 20px rgba(0,0,0,.4)",
                    outline:
                      pageIdx === activePage ? "2px solid #beffb6" : undefined,
                    outlineOffset: pageIdx === activePage ? 3 : undefined,
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
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

                  {/* Alignment guides */}
                  {guides?.page === pageIdx &&
                    guides.x.map((gx, i) => (
                      <div
                        key={`gx${i}`}
                        style={{
                          position: "absolute",
                          left: gx,
                          top: 0,
                          bottom: 0,
                          width: 1,
                          background: "#ff4da6",
                          pointerEvents: "none",
                          zIndex: 10,
                        }}
                      />
                    ))}
                  {guides?.page === pageIdx &&
                    guides.y.map((gy, i) => (
                      <div
                        key={`gy${i}`}
                        style={{
                          position: "absolute",
                          top: gy,
                          left: 0,
                          right: 0,
                          height: 1,
                          background: "#ff4da6",
                          pointerEvents: "none",
                          zIndex: 10,
                        }}
                      />
                    ))}

                  {/* Marquee selection rectangle */}
                  {marquee?.page === pageIdx && (
                    <div
                      style={{
                        position: "absolute",
                        left: marquee.x,
                        top: marquee.y,
                        width: marquee.w,
                        height: marquee.h,
                        background: "rgba(33,150,243,.12)",
                        border: "1px solid #2196F3",
                        pointerEvents: "none",
                        zIndex: 12,
                      }}
                    />
                  )}

                  {pageComps.map((comp) => {
                    if (comp.type === "pagebreak") return null;
                    const isSelected = selectedSet.has(comp.id);
                    const isPrimary =
                      comp.id === selectedId && selectedIds.length === 1;
                    const [rx, , rw, rh] = comp.rect;
                    const top = cssTop(comp.rect);
                    const handleSize = 8 / zoom;

                    return (
                      <div
                        key={comp.id}
                        onMouseDown={(e) => startDrag(e, comp.id, pageIdx)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (e.shiftKey || e.metaKey || e.ctrlKey)
                            toggleSelect(comp.id);
                          else selectOnly(comp.id);
                        }}
                        style={{
                          position: "absolute",
                          left: rx,
                          top,
                          width: rw,
                          height: rh,
                          cursor: comp.locked ? "default" : "move",
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
                              fontStyle: comp.style.italic
                                ? "italic"
                                : "normal",
                              textAlign: comp.style.align,
                              color: comp.style.color,
                              whiteSpace: "pre-wrap",
                              width: "100%",
                              height: "100%",
                            }}
                          >
                            {renderText(comp.content, editorContext, knownVars)}
                          </div>
                        )}

                        {isPrimary &&
                          !comp.locked &&
                          HANDLES.map((hh) => (
                            <div
                              key={hh.dir}
                              onMouseDown={(e) =>
                                startResize(e, comp.id, pageIdx, hh.dir)
                              }
                              style={{
                                position: "absolute",
                                left: `${hh.x * 100}%`,
                                top: `${hh.y * 100}%`,
                                width: handleSize,
                                height: handleSize,
                                transform: "translate(-50%, -50%)",
                                background: "#2196F3",
                                border: `${1 / zoom}px solid #fff`,
                                cursor: hh.cursor,
                                zIndex: 11,
                              }}
                            />
                          ))}
                      </div>
                    );
                  })}
                </div>
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
              {multiSelected ? (
                <GroupPanel
                  count={selectedIds.length}
                  onAlign={alignSelected}
                  onDistribute={distributeSelected}
                />
              ) : (
                <InspectorPanel
                  comp={selectedComp}
                  knownVars={knownVars}
                  contentRef={contentRef}
                  onContentSelect={(start, end) => {
                    contentSelRef.current = { start, end };
                  }}
                  onReorder={(mode) => {
                    if (selectedId)
                      commit({
                        type: "SET_COMPS",
                        comps: reorderComp(comps, selectedId, mode),
                      });
                  }}
                  onChange={(patch) => {
                    if (selectedId)
                      commit({ type: "UPDATE_COMP", id: selectedId, patch });
                  }}
                />
              )}
            </Tabs.Panel>

            <Tabs.Panel value="pages" style={{ flex: 1, overflow: "auto" }}>
              <PagesPanel
                pages={pages}
                activePage={activePage}
                onSwap={(i, j) => {
                  const next = swapPages(comps, i, j);
                  commit({ type: "SET_COMPS", comps: next });
                  setActivePage(j);
                }}
                onDelete={(idx) => {
                  const next = deletePage(comps, idx);
                  commit({ type: "SET_COMPS", comps: next });
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

// ── Group panel (multi-select align / distribute) ──────────────────────────
interface GroupPanelProps {
  count: number;
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: "x" | "y") => void;
}

function GroupPanel({ count, onAlign, onDistribute }: GroupPanelProps) {
  return (
    <Stack gap="xs" p="sm">
      <Text size="xs" fw={600}>
        {count} components selected
      </Text>
      <Text size="xs" c="dimmed">
        Shift-click to add/remove. Drag to move together.
      </Text>

      <Text size="xs" fw={600} mt="xs">
        Align
      </Text>
      <Group gap={4} wrap="wrap">
        <Button size="xs" variant="default" onClick={() => onAlign("left")}>
          Left
        </Button>
        <Button size="xs" variant="default" onClick={() => onAlign("hcenter")}>
          Center
        </Button>
        <Button size="xs" variant="default" onClick={() => onAlign("right")}>
          Right
        </Button>
      </Group>
      <Group gap={4} wrap="wrap">
        <Button size="xs" variant="default" onClick={() => onAlign("top")}>
          Top
        </Button>
        <Button size="xs" variant="default" onClick={() => onAlign("vmiddle")}>
          Middle
        </Button>
        <Button size="xs" variant="default" onClick={() => onAlign("bottom")}>
          Bottom
        </Button>
      </Group>

      <Text size="xs" fw={600} mt="xs">
        Distribute
      </Text>
      <Text size="xs" c="dimmed">
        Needs 3+ selected
      </Text>
      <Group gap={4} wrap="wrap">
        <Button size="xs" variant="default" onClick={() => onDistribute("x")}>
          Horizontally
        </Button>
        <Button size="xs" variant="default" onClick={() => onDistribute("y")}>
          Vertically
        </Button>
      </Group>
    </Stack>
  );
}

// ── Inspector panel ────────────────────────────────────────────────────────
interface InspectorPanelProps {
  comp: PdfComp | null;
  knownVars: Set<string>;
  contentRef: React.RefObject<HTMLTextAreaElement | null>;
  onContentSelect: (start: number, end: number) => void;
  onReorder: (mode: "front" | "back" | "forward" | "backward") => void;
  onChange: (patch: Partial<PdfComp>) => void;
}

function InspectorPanel({
  comp,
  knownVars,
  contentRef,
  onContentSelect,
  onReorder,
  onChange,
}: InspectorPanelProps) {
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

  const unknownVars =
    comp.type === "text"
      ? Array.from(
          new Set(
            Array.from(comp.content.matchAll(new RegExp(VAR_RE.source, "g")))
              .map((m) => m[1]!)
              .filter((k) => !knownVars.has(k)),
          ),
        )
      : [];

  return (
    <Stack gap="xs" p="sm">
      <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
        {comp.id}
      </Text>

      <Text size="xs" fw={600}>
        Order
      </Text>
      <Group gap={4} wrap="nowrap">
        <Button size="xs" variant="default" onClick={() => onReorder("back")}>
          To back
        </Button>
        <Button
          size="xs"
          variant="default"
          onClick={() => onReorder("backward")}
        >
          Back
        </Button>
        <Button
          size="xs"
          variant="default"
          onClick={() => onReorder("forward")}
        >
          Fwd
        </Button>
        <Button size="xs" variant="default" onClick={() => onReorder("front")}>
          To front
        </Button>
      </Group>

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
          min={MIN_SIZE}
          onChange={(v) => patchRect(2, Number(v))}
          w={80}
        />
        <NumberInput
          size="xs"
          label="H"
          value={comp.rect[3]}
          min={MIN_SIZE}
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
            ref={contentRef}
            size="xs"
            value={comp.content}
            placeholder="Text (supports {{variables}})"
            autosize
            minRows={2}
            maxRows={5}
            onChange={(e) => {
              onChange({ content: e.target.value } as Partial<PdfComp>);
              onContentSelect(
                e.currentTarget.selectionStart,
                e.currentTarget.selectionEnd,
              );
            }}
            onSelect={(e) =>
              onContentSelect(
                e.currentTarget.selectionStart,
                e.currentTarget.selectionEnd,
              )
            }
            onClick={(e) =>
              onContentSelect(
                e.currentTarget.selectionStart,
                e.currentTarget.selectionEnd,
              )
            }
            onKeyUp={(e) =>
              onContentSelect(
                e.currentTarget.selectionStart,
                e.currentTarget.selectionEnd,
              )
            }
          />
          {unknownVars.length > 0 && (
            <Text size="xs" c="orange">
              Unknown variable{unknownVars.length > 1 ? "s" : ""}:{" "}
              {unknownVars.map((u) => `{{${u}}}`).join(", ")}
            </Text>
          )}

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
