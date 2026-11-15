import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sample-tracker/client", () => ({
  getTemplate: vi.fn(),
  listSampleTypes: vi.fn(),
  listTemplates: vi.fn(),
  SampleTrackerError: class extends Error {},
}));
import { getTemplate, listSampleTypes, listTemplates } from "@/lib/sample-tracker/client";
import { listRequestCatalog, loadRequestTemplate } from "@/lib/experiment/data";

import { getLabOffer } from "./offer";

const sampleType = (id: string, name: string, isVisibleOnWeb = true) => ({
  id,
  name,
  description: null,
  reportForm: null,
  isVisibleOnWeb,
  displayOrder: 1,
  createdAt: "",
  updatedAt: "",
});
const template = (id: string, name: string, isVisibleOnWeb = true) => ({
  id,
  sampleTypeId: "z",
  name,
  description: null,
  template: {},
  isVisibleOnWeb,
  displayOrder: 1,
  createdAt: "",
  updatedAt: "",
});

beforeEach(() => {
  vi.mocked(listSampleTypes).mockResolvedValue([sampleType("z", "Zinc"), sampleType("empty", "Empty")]);
  vi.mocked(listTemplates).mockImplementation(async (_actor, id) =>
    id === "empty" ? [] : [template("z", "Z test"), template("c", "C test")],
  );
});

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

  it("leaves out hidden sample types and methods, in both catalogues", async () => {
    vi.mocked(listSampleTypes).mockResolvedValue([
      sampleType("z", "Zinc"),
      sampleType("h", "Hidden type", false),
    ]);
    vi.mocked(listTemplates).mockResolvedValue([
      template("z", "Z test"),
      template("c", "C test", false),
    ]);
    const offer = await getLabOffer();
    expect(offer?.map((s) => [s.name, s.experiments.map((e) => e.name)])).toEqual([
      ["Zinc", ["Z test"]],
    ]);
    const catalogue = await listRequestCatalog();
    expect(catalogue.map((g) => [g.sampleName, g.templates.map((t) => t.title)])).toEqual([
      ["Zinc", ["Z test"]],
    ]);
  });

  it("cannot open a hidden method, or a method of a hidden sample type, for request", async () => {
    vi.mocked(listTemplates).mockResolvedValue([template("z", "Z test"), template("c", "C test", false)]);
    vi.mocked(getTemplate).mockResolvedValue(template("c", "C test", false));
    expect(await loadRequestTemplate("c")).toBeNull();

    vi.mocked(getTemplate).mockResolvedValue(template("z", "Z test"));
    const shown = await loadRequestTemplate("z");
    expect(shown?.methods.map((m) => m.meta.title)).toEqual(["Z test"]);

    vi.mocked(listSampleTypes).mockResolvedValue([sampleType("z", "Zinc", false)]);
    expect(await loadRequestTemplate("z")).toBeNull();
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
