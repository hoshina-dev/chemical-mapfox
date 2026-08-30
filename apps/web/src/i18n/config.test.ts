import { describe, expect, it } from "vitest";

import { localeFromCookie } from "@/i18n/config";
import { mergeMessages } from "@/i18n/mergeMessages";

describe("localeFromCookie", () => {
  it("honours a supported NEXT_LOCALE cookie", () => {
    expect(localeFromCookie("en")).toBe("en");
    expect(localeFromCookie("pl")).toBe("pl");
  });

  it("defaults to Polish when the cookie is missing or unsupported", () => {
    expect(localeFromCookie(null)).toBe("pl");
    expect(localeFromCookie(undefined)).toBe("pl");
    expect(localeFromCookie("th")).toBe("pl");
    expect(localeFromCookie("de")).toBe("pl");
  });
});

describe("mergeMessages", () => {
  it("deep-merges so incomplete locales inherit English keys", () => {
    expect(
      mergeMessages(
        { common: { cancel: "Cancel", save: "Save" }, meta: { description: "EN" } },
        { common: { cancel: "Anuluj" } },
      ),
    ).toEqual({
      common: { cancel: "Anuluj", save: "Save" },
      meta: { description: "EN" },
    });
  });
});
