"use client";

import { NativeSelect } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setLocaleAction } from "@/app/actions/locale";
import { locales, type AppLocale } from "@/i18n/config";

const LOCALE_NATIVE_NAMES: Record<AppLocale, string> = {
  en: "English",
  pl: "Polski",
  th: "ไทย",
};

export interface LanguageSwitcherProps {
  /** Compact control for nav bars. */
  size?: "xs" | "sm" | "md";
  /** Tune colors for dark staff chrome. */
  variant?: "light" | "dark";
}

export function LanguageSwitcher({
  size = "xs",
  variant = "light",
}: LanguageSwitcherProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.language");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <NativeSelect
      aria-label={t("label")}
      size={size}
      value={locale}
      disabled={pending}
      data={locales.map((code) => ({
        value: code,
        label: LOCALE_NATIVE_NAMES[code],
      }))}
      onChange={(event) => {
        const next = event.currentTarget.value;
        startTransition(async () => {
          await setLocaleAction(next);
          router.refresh();
        });
      }}
      styles={
        variant === "dark"
          ? {
              input: {
                backgroundColor: "transparent",
                color: "var(--mantine-color-gray-3)",
                borderColor: "var(--mantine-color-dark-4)",
              },
            }
          : undefined
      }
    />
  );
}
