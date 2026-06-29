/**
 * Laboratory-offer data for the public landing page.
 *
 * NOTE: Experiment Manager is currently offline, so this serves **mock** data.
 * When the service is back, replace `getLabOffer()` with the commented-out
 * implementation below (samples + nested experiment templates), which mirrors
 * this shape exactly.
 */

export interface OfferExperiment {
  id: string;
  name: string;
  description?: string;
}

export interface OfferSample {
  id: string;
  name: string;
  description?: string;
  experiments: OfferExperiment[];
}

const MOCK_OFFER: OfferSample[] = [
  {
    id: "water",
    name: "Water & Wastewater",
    description:
      "Drinking, surface, process and waste water — physicochemical and microbiological analysis.",
    experiments: [
      {
        id: "water-micro",
        name: "Microbiological analysis",
        description:
          "Total coliforms, E. coli and enterococci enumeration to drinking-water limits.",
      },
      {
        id: "water-metals",
        name: "Heavy metals (ICP-MS)",
        description:
          "Lead, cadmium, arsenic, mercury and nickel at trace concentrations.",
      },
      {
        id: "water-ph",
        name: "pH & conductivity",
        description: "Electrochemical determination of pH and specific conductivity.",
      },
      {
        id: "water-nitrate",
        name: "Nitrate & nitrite",
        description: "Ion chromatography of inorganic nitrogen species.",
      },
    ],
  },
  {
    id: "food",
    name: "Food & Feed",
    description:
      "Safety and quality testing for raw materials, finished products and animal feed.",
    experiments: [
      {
        id: "food-pesticide",
        name: "Pesticide residue screening",
        description: "Multi-residue GC-MS/MS and LC-MS/MS panel (>400 analytes).",
      },
      {
        id: "food-nutrition",
        name: "Nutritional profile",
        description: "Protein, fat, carbohydrate, fibre and energy for labelling.",
      },
      {
        id: "food-mycotoxin",
        name: "Mycotoxin analysis",
        description: "Aflatoxins, ochratoxin A and deoxynivalenol by HPLC-FLD.",
      },
      {
        id: "food-allergen",
        name: "Allergen detection",
        description: "ELISA screening for gluten, milk, egg, soy and nut proteins.",
      },
    ],
  },
  {
    id: "soil",
    name: "Soil & Sediment",
    description:
      "Contamination assessment and agronomic characterisation of soils and sediments.",
    experiments: [
      {
        id: "soil-tph",
        name: "Total petroleum hydrocarbons",
        description: "C10–C40 hydrocarbon quantification by GC-FID.",
      },
      {
        id: "soil-metals",
        name: "Heavy metals",
        description: "Aqua-regia digestion with ICP-OES determination.",
      },
      {
        id: "soil-toc",
        name: "Organic carbon & matter",
        description: "Total organic carbon and loss-on-ignition.",
      },
    ],
  },
  {
    id: "production",
    name: "Production Environment",
    description:
      "Hygiene monitoring of surfaces, air and personnel in production areas.",
    experiments: [
      {
        id: "prod-swab",
        name: "Surface swab microbiology",
        description: "Total viable count and indicator organisms from contact surfaces.",
      },
      {
        id: "prod-air",
        name: "Airborne microbial load",
        description: "Active air sampling for bacteria and moulds in clean zones.",
      },
      {
        id: "prod-sporal",
        name: "Sterilisation control (Sporal A)",
        description: "Biological indicators verifying autoclave sterilisation.",
      },
    ],
  },
  {
    id: "pharma",
    name: "Pharmaceutical",
    description:
      "Release and stability testing for pharmaceutical dosage forms.",
    experiments: [
      {
        id: "pharma-assay",
        name: "Assay (HPLC)",
        description: "Active ingredient content by validated reversed-phase HPLC.",
      },
      {
        id: "pharma-dissolution",
        name: "Dissolution testing",
        description: "USP apparatus dissolution profiling of solid dosage forms.",
      },
      {
        id: "pharma-sterility",
        name: "Sterility & endotoxin",
        description: "Sterility assurance and bacterial endotoxin (LAL) testing.",
      },
    ],
  },
];

/**
 * Returns the laboratory offer. Currently mock data (Experiment Manager offline).
 *
 * When the service is restored, swap the body for the real loader:
 *
 *   const { samples } = await listSamples();
 *   return Promise.all(
 *     samples.map(async (s) => {
 *       const { experiments } = await listExperimentTemplates(s.id);
 *       return {
 *         id: s.id,
 *         name: s.name,
 *         description: s.description ?? undefined,
 *         experiments: experiments.map((e) => ({
 *           id: e.id,
 *           name: e.name,
 *           description: e.description ?? undefined,
 *         })),
 *       };
 *     }),
 *   );
 */
export async function getLabOffer(): Promise<OfferSample[] | null> {
  return MOCK_OFFER;
}
