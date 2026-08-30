/** Supported UI locales. English is the message-catalog fallback. */
export const locales = ["en", "pl"] as const;

export type AppLocale = (typeof locales)[number];

/** First-visit UI locale when `NEXT_LOCALE` is unset or unsupported. */
export const defaultLocale: AppLocale = "pl";

/**
 * Locale used as the message-catalog merge base and docs-screenshot fallback.
 * Independent of {@link defaultLocale} (the UI default is Polish).
 */
export const messageFallbackLocale: AppLocale = "en";

/** Cookie storing the user's language preference (SSR-readable). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value != null && (locales as readonly string[]).includes(value);
}

/** Cookie wins; otherwise Polish. Browser `Accept-Language` is ignored. */
export function localeFromCookie(
  value: string | undefined | null,
): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}
