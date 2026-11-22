import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/dal", () => ({ requireClient: vi.fn() }));
vi.mock("@/lib/experiment/data", () => ({ loadRequestTemplate: vi.fn() }));
vi.mock("@/lib/experiment-manager/client", () => ({
  createTicket: vi.fn(),
  experimentManagerMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock("@/lib/log/handled", () => ({ logHandledError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
import { requireClient } from "@/lib/auth/dal";
import { loadRequestTemplate } from "@/lib/experiment/data";
import { createTicket } from "@/lib/experiment-manager/client";

import { requestExperimentAction } from "./experiment-request";

// Ash and Moisture both ask "mass", with different limits.
const method = (id: string, title: string, max: number) => ({
  id,
  meta: { title },
  template: {
    clientForm: {
      name: title,
      questions: [{ id: "mass", label: "Sample mass", type: "number", required: true, config: { max } }],
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireClient).mockResolvedValue({ userId: "client-1" } as never);
  vi.mocked(loadRequestTemplate).mockResolvedValue({
    sampleId: "coal",
    sampleName: "Coal",
    methods: [method("ash", "Ash", 100), method("moisture", "Moisture", 50)],
  } as never);
  vi.mocked(createTicket).mockResolvedValue({ id: "ticket-1" } as never);
});

const request = (values: unknown) =>
  requestExperimentAction({
    templateId: "ash",
    templateIds: ["ash", "moisture"],
    values: values as never,
    requestKey: "request-key-1",
  });

it("stores each method's own answer to a question id both methods ask", async () => {
  const result = await request({ ash: { mass: 80 }, moisture: { mass: 30 } });
  expect(result).toEqual({ success: true, data: { contextId: "ticket-1" } });
  expect(vi.mocked(createTicket).mock.calls[0][1].clientAnswers).toEqual({
    ash: { mass: 80 },
    moisture: { mass: 30 },
  });
});

it("checks each method's answers against that method's own form", async () => {
  // 80 is within Ash's limit but over Moisture's.
  const result = await request({ ash: { mass: 80 }, moisture: { mass: 80 } });
  expect(result.success).toBe(false);
  expect(!result.success && result.error).toMatch(/^submitFailed\nMoisture\n/);
  expect(createTicket).not.toHaveBeenCalled();
});

it("refuses answers for a method that was not requested", async () => {
  const result = await request({ ash: { mass: 1 }, moisture: { mass: 1 }, other: { mass: 1 } });
  expect(result).toEqual({ success: false, error: "invalidPayload" });
  expect(createTicket).not.toHaveBeenCalled();
});
