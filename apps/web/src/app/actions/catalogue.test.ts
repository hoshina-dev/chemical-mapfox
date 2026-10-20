import { expect, it, vi } from "vitest";
vi.mock("@/lib/auth/dal", () => ({
  requireAdmin: vi.fn().mockRejectedValue(new Error("Forbidden")),
}));
vi.mock("@/lib/experiment-manager/client", () => ({
  setSampleWebVisibility: vi.fn(),
  setSamplesWebOrder: vi.fn(),
  setTemplateWebVisibility: vi.fn(),
  setTemplatesWebOrder: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));
import {
  setCatalogueOrderAction,
  setCatalogueVisibilityAction,
} from "./experiment-manager";
import {
  setSamplesWebOrder,
  setSampleWebVisibility,
} from "@/lib/experiment-manager/client";
it("requires staff authorization before catalogue writes", async () => {
  await expect(setCatalogueVisibilityAction("sample", true)).rejects.toThrow(
    "Forbidden",
  );
  await expect(setCatalogueOrderAction(["sample"])).rejects.toThrow(
    "Forbidden",
  );
  expect(setSamplesWebOrder).not.toHaveBeenCalled();
  expect(setSampleWebVisibility).not.toHaveBeenCalled();
});
