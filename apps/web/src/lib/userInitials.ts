export interface UserInitialsInput {
  name?: string | null;
  email?: string | null;
}

function initialsFromDisplayName(value?: string | null): string | null {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 1).toUpperCase();
  }
  return null;
}

/** First letter of first name + first letter of last name (when available). */
export function userInitials({ name, email }: UserInitialsInput): string {
  const fromName = initialsFromDisplayName(name);
  if (fromName) return fromName;

  const trimmedEmail = email?.trim();
  if (trimmedEmail) {
    /* v8 ignore next -- split always returns at least one element */
    const local = trimmedEmail.split("@")[0] ?? "";
    const fromLocal = initialsFromDisplayName(local.replace(/[._-]+/g, " "));
    if (fromLocal) return fromLocal;
    return local.slice(0, 1).toUpperCase() || "?";
  }

  return "?";
}
