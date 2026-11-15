/** Tinted badge/chip colors keyed by Mantine status color name. */
const DEFAULT_COLORS = { bg: "#f1f3f5", fg: "#495057", dot: "#adb5bd" };

export const STATUS_COLOR_PALETTE: Record<string, { bg: string; fg: string; dot: string }> = {
  blue: { bg: "#e7f5ff", fg: "#1864ab", dot: "#339af0" },
  gray: DEFAULT_COLORS,
  cyan: { bg: "#e3fafc", fg: "#0b7285", dot: "#22b8cf" },
  yellow: { bg: "#fff4e6", fg: "#c04a00", dot: "#fd7e14" },
  teal: { bg: "#f3fbe8", fg: "#2b6b10", dot: "#74c214" },
  green: { bg: "#ebfbee", fg: "#1a6b2a", dot: "#40c057" },
  red: { bg: "#fff5f5", fg: "#c92a2a", dot: "#fa5252" },
};

export function colorsForStatus(mantineColor: string): { bg: string; fg: string; dot: string } {
  return STATUS_COLOR_PALETTE[mantineColor] ?? DEFAULT_COLORS;
}
