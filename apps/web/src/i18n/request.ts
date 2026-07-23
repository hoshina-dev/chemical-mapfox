import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import {
  isAppLocale,
  LOCALE_COOKIE,
  negotiateLocale,
  type AppLocale,
} from "./config";
import "./global";
import { mergeMessages } from "./mergeMessages";

async function loadMessages(locale: AppLocale) {
  const en = (await import("../../messages/en.json")).default;
  if (locale === "en") return en;

  const localized = (await import(`../../messages/${locale}.json`)).default;
  return mergeMessages(en, localized);
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const headerStore = await headers();
  const locale: AppLocale = isAppLocale(cookieLocale)
    ? cookieLocale
    : negotiateLocale(headerStore.get("accept-language"));

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
