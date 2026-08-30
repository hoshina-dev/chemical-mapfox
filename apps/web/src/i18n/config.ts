/** Supported UI locales. English is the default and message fallback. */
export const locales = ["en", "pl"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

/**
 * Locale used as the message-catalog merge base and docs-screenshot fallback.
 */
export const messageFallbackLocale: AppLocale = "en";

/** Cookie storing the user's language preference (SSR-readable). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value != null && (locales as readonly string[]).includes(value);
}

/**
 * Pick the best supported locale from an Accept-Language header value.
 * Falls back to English when nothing matches.
 */
export function negotiateLocale(acceptLanguage: string | null): AppLocale {
  if (!acceptLanguage) return defaultLocale;

  const preferred = acceptLanguage.split(",").map((part) => {
    const [tag, ...params] = part.trim().split(";");
    const qParam = params.find((p) => p.trim().startsWith("q="));
    const q = qParam ? Number(qParam.trim().slice(2)) : 1;
    return { tag: (tag ?? "").trim().toLowerCase(), q: Number.isFinite(q) ? q : 1 };
  });

  preferred.sort((a, b) => b.q - a.q);

  for (const { tag } of preferred) {
    if (!tag) continue;
    if (isAppLocale(tag)) return tag;
    const base = tag.split("-")[0];
    if (isAppLocale(base)) return base;
  }

  return defaultLocale;
}
