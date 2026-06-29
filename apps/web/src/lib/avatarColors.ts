const AVATAR_COLORS = ["blue", "grape", "green", "orange", "pink"] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

function hashIndex(value: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % length;
  }
  return Math.abs(hash);
}

/** Stable Mantine color for a user, derived from name or email. */
export function avatarColorFor(value: string): AvatarColor {
  if (!value) return AVATAR_COLORS[0];
  /* v8 ignore next -- modulo index is always in range; fallback satisfies noUncheckedIndexedAccess */
  return AVATAR_COLORS[hashIndex(value, AVATAR_COLORS.length)] ?? AVATAR_COLORS[0];
}

export function avatarColorSeed(input: {
  name?: string | null;
  email?: string | null;
}): string {
  return input.name?.trim() || input.email?.trim() || "";
}
