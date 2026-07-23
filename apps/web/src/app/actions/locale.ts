"use server";

import { cookies } from "next/headers";

import {
  isAppLocale,
  LOCALE_COOKIE,
  type AppLocale,
} from "@/i18n/config";

export async function setLocaleAction(locale: string): Promise<AppLocale | null> {
  if (!isAppLocale(locale)) return null;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return locale;
}
