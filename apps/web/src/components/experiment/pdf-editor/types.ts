export type Rect = [number, number, number, number]; // [x, y, w, h] — PDF bottom-left origin

export interface TextStyle {
  font: string;
  size: number;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  color: string;
}

export interface TextComp {
  id: string;
  type: "text";
  content: string;
  rect: Rect;
  style: TextStyle;
  /** Editor-only: prevents drag/resize. Stripped before saving. */
  locked?: boolean;
}

export interface ShapeComp {
  id: string;
  type: "shape";
  shape_type: "rect" | "line" | "circle";
  rect: Rect;
  color: string;
  stroke_width: number;
  fill: boolean;
  /** Editor-only: prevents drag/resize. Stripped before saving. */
  locked?: boolean;
}

export interface PageBreakComp {
  id: string;
  type: "pagebreak";
}

export type PdfComp = TextComp | ShapeComp | PageBreakComp;

export interface VariableGroup {
  name: string;
  variables: Array<{ id: string; label: string }>;
}

export type PreviewMode = "raw" | "defaults" | "experiment";

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/**
 * Runtime check for components from outside the editor (clipboard, stored
 * layouts, the save action). Shapes are rendered as SVG markup, so a
 * non-numeric rect or stroke would otherwise inject HTML. Deliberately loose
 * elsewhere so older saved layouts still load.
 */
export function isPdfComp(v: unknown): v is PdfComp {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  if (typeof c.id !== "string") return false;
  if (c.type === "pagebreak") return true;
  const rectOk =
    Array.isArray(c.rect) && c.rect.length === 4 && c.rect.every(isFiniteNumber);
  if (c.type === "text") {
    return rectOk && typeof c.content === "string" && typeof c.style === "object";
  }
  if (c.type === "shape") {
    return (
      rectOk &&
      typeof c.shape_type === "string" &&
      typeof c.color === "string" &&
      isFiniteNumber(c.stroke_width)
    );
  }
  return false;
}
