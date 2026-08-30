import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import {
  LOCALE_COOKIE,
  localeFromCookie,
  messageFallbackLocale,
  type AppLocale,
} from "./config";
import "./global";
import { mergeMessages } from "./mergeMessages";

async function loadMessages(locale: AppLocale) {
  const en = (await import("../../messages/en.json")).default;
  if (locale === messageFallbackLocale) return en;

  const localized = (await import(`../../messages/${locale}.json`)).default;
  return mergeMessages(en, localized);
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = localeFromCookie(store.get(LOCALE_COOKIE)?.value);

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
