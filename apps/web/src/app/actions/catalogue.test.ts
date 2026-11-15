import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/sample-tracker/client", () => ({
  setSampleTypesWebOrder: vi.fn(),
  setSampleTypeWebVisibility: vi.fn(),
  setTemplatesWebOrder: vi.fn(),
  setTemplateWebVisibility: vi.fn(),
  sampleTrackerMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock("@/lib/log/handled", () => ({ logHandledError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
import { requireAdmin } from "@/lib/auth/dal";
import {
  setSampleTypesWebOrder,
  setSampleTypeWebVisibility,
  setTemplatesWebOrder,
  setTemplateWebVisibility,
} from "@/lib/sample-tracker/client";

import { setCatalogueOrderAction, setCatalogueVisibilityAction } from "./onboarding";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue({ userId: "staff-1" } as never);
});

it("requires staff authorization before catalogue writes", async () => {
  vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));
  await expect(setCatalogueVisibilityAction("sample", true)).rejects.toThrow("Forbidden");
  await expect(setCatalogueOrderAction(["sample"])).rejects.toThrow("Forbidden");
  expect(setSampleTypesWebOrder).not.toHaveBeenCalled();
  expect(setSampleTypeWebVisibility).not.toHaveBeenCalled();
});

it("writes sample types without a sampleId and that sample type's templates with one", async () => {
  await setCatalogueVisibilityAction("type-1", false);
  await setCatalogueVisibilityAction("tpl-1", true, "type-1");
  await setCatalogueOrderAction(["type-2", "type-1"]);
  await setCatalogueOrderAction(["tpl-2", "tpl-1"], "type-1");
  expect(setSampleTypeWebVisibility).toHaveBeenCalledWith("staff-1", "type-1", false);
  expect(setTemplateWebVisibility).toHaveBeenCalledWith("staff-1", "tpl-1", true);
  expect(setSampleTypesWebOrder).toHaveBeenCalledWith("staff-1", ["type-2", "type-1"]);
  expect(setTemplatesWebOrder).toHaveBeenCalledWith("staff-1", "type-1", ["tpl-2", "tpl-1"]);
});

it("reports a refused write so the editor can restore the previous state", async () => {
  vi.mocked(setSampleTypesWebOrder).mockRejectedValue(new Error("409"));
  expect(await setCatalogueOrderAction(["type-1"])).toEqual({ success: false, error: "saveError" });
});
