import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sample-tracker/client", () => ({
  listSampleTypes: vi.fn(),
  listTemplates: vi.fn(),
}));
import { listSampleTypes, listTemplates } from "@/lib/sample-tracker/client";
import { listRequestCatalog } from "@/lib/experiment/data";

import { getLabOffer } from "./offer";

const sampleType = (id: string, name: string) => ({
  id,
  name,
  description: null,
  reportForm: null,
  createdAt: "",
  updatedAt: "",
});
const template = (id: string, name: string) => ({
  id,
  sampleTypeId: "z",
  name,
  description: null,
  template: {},
  createdAt: "",
  updatedAt: "",
});

beforeEach(() => {
  vi.mocked(listSampleTypes).mockResolvedValue([sampleType("z", "Zinc"), sampleType("empty", "Empty")]);
  vi.mocked(listTemplates).mockImplementation(async (_actor, id) =>
    id === "empty" ? [] : [template("z", "Z test"), template("c", "C test")],
  );
});

// TODO(catalogue visibility): add the hidden-sample/method cases back once
// sample_tracker has visibility and order.
describe("catalogue", () => {
  it("offers every sample type with its methods, in sample_tracker's order", async () => {
    const offer = await getLabOffer();
    expect(offer?.map((sample) => sample.name)).toEqual(["Zinc", "Empty"]);
    expect(offer?.[0]?.experiments.map((test) => [test.name, test.canRequest])).toEqual([
      ["Z test", true],
      ["C test", true],
    ]);
    expect(offer?.[1]?.experiments).toEqual([]);
  });

  it("groups the request catalogue by sample type", async () => {
    const catalogue = await listRequestCatalog();
    expect(catalogue.map((group) => group.sampleName)).toEqual(["Zinc", "Empty"]);
    expect(catalogue[0]?.templates.map((test) => test.title)).toEqual(["Z test", "C test"]);
  });

  it("keeps a sample type whose methods cannot load", async () => {
    vi.mocked(listTemplates).mockRejectedValue(new Error("offline"));
    expect((await getLabOffer())?.every((sample) => sample.experiments.length === 0)).toBe(true);
  });

  it("degrades to null when sample_tracker is unreachable", async () => {
    vi.mocked(listSampleTypes).mockRejectedValue(new Error("offline"));
    expect(await getLabOffer()).toBeNull();
  });
});
