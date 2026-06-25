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
}

export interface ShapeComp {
  id: string;
  type: "shape";
  shape_type: "rect" | "line" | "circle";
  rect: Rect;
  color: string;
  stroke_width: number;
  fill: boolean;
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
