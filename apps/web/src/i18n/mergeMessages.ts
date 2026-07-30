type MessageValue = string | string[] | MessageTree;
type MessageTree = { [key: string]: MessageValue };

/** Deep-merge message trees so incomplete locales fall back to English keys. */
export function mergeMessages<T extends MessageTree>(
  base: T,
  override: MessageTree,
): T {
  const result: MessageTree = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing !== null &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      result[key] = mergeMessages(existing, value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
