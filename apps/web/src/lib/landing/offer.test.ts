import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/experiment-manager/client", () => ({
  listSamples: vi.fn(),
  listExperimentTemplates: vi.fn(),
}));
vi.mock("@/lib/ticketing/client", () => ({ ticketsApi: {} }));
import {
  listSamples,
  listExperimentTemplates,
} from "@/lib/experiment-manager/client";
import { getLabOffer } from "./offer";
import { listRequestCatalog } from "@/lib/experiment/data";

const specimens = [
  {
    id: "z",
    name: "Zinc",
    description: null,
    is_visible_on_web: true,
    display_order: 1,
  },
  {
    id: "a",
    name: "Aluminium",
    description: null,
    is_visible_on_web: false,
    display_order: 2,
  },
  {
    id: "empty",
    name: "Empty",
    description: null,
    is_visible_on_web: true,
    display_order: 3,
  },
];
const tests = [
  {
    id: "z",
    lineage_id: "z",
    name: "Z test",
    description: null,
    version: 1,
    is_current: true,
    is_visible_on_web: true,
    has_pdf_template: false,
    display_order: 1,
  },
  {
    id: "a",
    lineage_id: "a",
    name: "A test",
    description: null,
    version: 1,
    is_current: true,
    is_visible_on_web: false,
    has_pdf_template: true,
    display_order: 2,
  },
  {
    id: "c",
    lineage_id: "c",
    name: "C test",
    description: null,
    version: 1,
    is_current: true,
    is_visible_on_web: true,
    has_pdf_template: true,
    display_order: 3,
  },
  {
    id: "old",
    lineage_id: "old",
    name: "Old",
    description: null,
    version: 1,
    is_current: false,
    is_visible_on_web: true,
    has_pdf_template: true,
    display_order: 4,
  },
];
beforeEach(() => {
  vi.mocked(listSamples).mockResolvedValue({ samples: specimens });
  vi.mocked(listExperimentTemplates).mockImplementation(async (id) => ({
    sample_id: id,
    experiments: id === "empty" ? [] : tests,
  }));
});
describe("catalogue visibility and eligibility", () => {
  it("lists visible current tests regardless of PDF readiness and preserves backend order", async () => {
    const offer = await getLabOffer();
    expect(offer?.map((sample) => sample.name)).toEqual(["Zinc", "Empty"]);
    expect(
      offer?.[0]?.experiments.map((test) => [test.name, test.canRequest]),
    ).toEqual([
      ["Z test", false],
      ["C test", true],
    ]);
    expect(offer?.[1]?.experiments).toEqual([]);
  });
  it("keeps hidden PDF-ready tests requestable and follows persisted ordering", async () => {
    const catalogue = await listRequestCatalog();
    expect(catalogue.map((group) => group.sampleName)).toEqual([
      "Zinc",
      "Aluminium",
      "Empty",
    ]);
    expect(catalogue[0]?.templates.map((test) => test.title)).toEqual([
      "A test",
      "C test",
    ]);
  });
  it("returns an empty public list when every specimen is hidden", async () => {
    vi.mocked(listSamples).mockResolvedValue({
      samples: specimens.map((sample) => ({
        ...sample,
        is_visible_on_web: false,
      })),
    });
    expect(await getLabOffer()).toEqual([]);
  });
  it("retains a visible specimen when its templates cannot load", async () => {
    vi.mocked(listExperimentTemplates).mockRejectedValue(new Error("offline"));
    expect(
      (await getLabOffer())?.every((sample) => sample.experiments.length === 0),
    ).toBe(true);
  });
});
