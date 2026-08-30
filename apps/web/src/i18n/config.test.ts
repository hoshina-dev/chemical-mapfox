import { describe, expect, it } from "vitest";

import { negotiateLocale } from "@/i18n/config";
import { mergeMessages } from "@/i18n/mergeMessages";

describe("negotiateLocale", () => {
  it("prefers an exact supported locale", () => {
    expect(negotiateLocale("en,pl;q=0.8")).toBe("en");
    expect(negotiateLocale("pl-PL,en;q=0.5")).toBe("pl");
  });

  it("falls back to English when nothing matches", () => {
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("de-DE,fr;q=0.9")).toBe("en");
    expect(negotiateLocale("th")).toBe("en");
  });

  it("honours an explicit q=0 as 'do not use this language'", () => {
    // pl is explicitly excluded; de isn't supported either, so English wins.
    expect(negotiateLocale("de;q=0.9,pl;q=0")).toBe("en");
    // Once pl is excluded, the next (supported) preference should still win.
    expect(negotiateLocale("pl;q=0,en;q=0.1")).toBe("en");
  });

  it("recognizes an uppercase Q= parameter", () => {
    expect(negotiateLocale("en;Q=0.1,pl;Q=0.9")).toBe("pl");
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
