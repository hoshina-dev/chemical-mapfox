/**
 * Deterministic per-editor color for the collaborative form UI (presence
 * avatars + the highlight border on a field being edited). Same `userId` always
 * maps to the same Mantine color, so every client agrees without coordination.
 *
 * The palette intentionally avoids the hues used by status badges
 * (blue/yellow/teal/green/red/gray — see `lib/ticketing/tickets.ts`) so an
 * editor color is never confused with a status.
 */
export const EDITOR_PALETTE = [
  "grape",
  "violet",
  "indigo",
  "cyan",
  "pink",
  "orange",
  "lime",
] as const;

export type EditorColor = (typeof EDITOR_PALETTE)[number];

export function editorColor(userId: string): EditorColor {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  // Tuple index [0] is statically known (never undefined); the computed index
  // narrows to `| undefined` under noUncheckedIndexedAccess, hence the fallback.
  return EDITOR_PALETTE[hash % EDITOR_PALETTE.length] ?? EDITOR_PALETTE[0];
}
