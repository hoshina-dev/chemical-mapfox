import { describe, expect, it } from "vitest";

import { negotiateLocale } from "@/i18n/config";
import { mergeMessages } from "@/i18n/mergeMessages";

describe("negotiateLocale", () => {
  it("prefers an exact supported locale", () => {
    expect(negotiateLocale("th,en;q=0.8")).toBe("th");
    expect(negotiateLocale("pl-PL,en;q=0.5")).toBe("pl");
  });

  it("falls back to English when nothing matches", () => {
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("de-DE,fr;q=0.9")).toBe("en");
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
