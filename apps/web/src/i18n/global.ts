import { defaultLocale, locales, type AppLocale } from "./config";

declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    // Intentionally omit Messages typing — the catalog is large enough that
    // full `typeof en` inference makes `useTranslations` / Zod-adjacent
    // call sites hit "Type instantiation is excessively deep".
  }
}

export { defaultLocale, locales };
export type { AppLocale };
