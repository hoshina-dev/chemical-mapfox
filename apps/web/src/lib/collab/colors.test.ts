import { describe, expect, it } from "vitest";

import { EDITOR_PALETTE, editorColor } from "./colors";

describe("editorColor", () => {
  it("is deterministic for the same userId", () => {
    expect(editorColor("user-123")).toBe(editorColor("user-123"));
    expect(editorColor("3f9c-aa")).toBe(editorColor("3f9c-aa"));
  });

  it("always returns a color from the palette", () => {
    for (const id of ["a", "b", "c", "d-e-f", "00000000-0000-0000"]) {
      expect(EDITOR_PALETTE).toContain(editorColor(id));
    }
  });

  it("avoids status-badge hues", () => {
    const statusHues = ["blue", "yellow", "teal", "green", "red", "gray"];
    for (const color of EDITOR_PALETTE) {
      expect(statusHues).not.toContain(color);
    }
  });

  it("spreads across more than one color for varied ids", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(editorColor(`user-${i}`));
    expect(seen.size).toBeGreaterThan(1);
  });
});
