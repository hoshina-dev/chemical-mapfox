import { registerStub } from "../registry.js";
import type { StubContext } from "../types.js";

/**
 * Staff PDF template builder. Backs the data the PDF editor page needs to mount
 * (the experiment template + its current PDF layout), the `upsertPdfTemplate`
 * save, the ticketing list that feeds the "preview from experiment" dropdown,
 * and the flattened experiment context used to resolve `{{field}}` placeholders.
 *
 * One sample + one template/lineage are seeded as constants (the editor only
 * ever opens a single fixed template in these scenarios); `seed` exposes the ids
 * to the step definitions so they can build the editor URL and assertions.
 */

const SAMPLE_ID = "sample-1";
// The template version id and its lineage id are intentionally equal so a save
// (addressed by lineage) lands back on the same version — the editor then stays
// on the current URL instead of navigating to a new canonical one.
const TEMPLATE_ID = "tmpl-1";
const LINEAGE_ID = "tmpl-1";
const CONTEXT_ID = "exp-ctx-1";
const EXPERIMENT_NAME = "Preview Experiment";
const PREVIEW_VALUE = "Acme Sample";
const ISO = new Date("2025-02-03T04:05:00.000Z").toISOString();

export const seed = {
  sampleId: SAMPLE_ID,
  templateId: TEMPLATE_ID,
  lineageId: LINEAGE_ID,
  contextId: CONTEXT_ID,
  experimentName: EXPERIMENT_NAME,
  previewValue: PREVIEW_VALUE,
};

interface PdfBuilderState {
  /** How many times the upsert (save) endpoint has been hit this scenario. */
  upsertCount: number;
  /** The components array of the most recent save (for assertions). */
  lastSavedComponents: unknown[] | null;
}

const state: PdfBuilderState = { upsertCount: 0, lastSavedComponents: null };

/** Read the module-local state from step definitions (same Node process). */
export function pdfBuilderState(): PdfBuilderState {
  return state;
}

function reset(): void {
  state.upsertCount = 0;
  state.lastSavedComponents = null;
}

// The PDF layout already saved for the template. One text element referencing a
// `{{client_name}}` placeholder so the experiment preview has something to fill.
const savedComponents = [
  {
    id: "text_seed_1",
    type: "text",
    content: `Sample: {{client_name}}`,
    rect: [50, 680, 512, 30],
    style: {
      font: "Helvetica",
      size: 14,
      bold: false,
      italic: false,
      align: "left",
      color: "#000000",
    },
  },
];

/** experiment-manager ExperimentTemplateDetail (only the fields the page reads). */
function templateDetail() {
  return {
    id: TEMPLATE_ID,
    lineage_id: LINEAGE_ID,
    version_id: TEMPLATE_ID,
    name: "Acceptance PDF Template",
    clientForm: {
      questions: [{ id: "client_name", label: "Client Name", type: "text" }],
    },
    labForm: { questions: [] },
    calculations: {},
  };
}

async function handle(ctx: StubContext): Promise<boolean> {
  const { method, path } = ctx;

  // experiment-manager calls keep their own `/api/...` paths (no `/api/v1`
  // prefix to strip), so segments start with "api".
  if (path[0] === "api" && path[1] === "samples") {
    // /api/samples/{sampleId}/experiments/{templateId}[/pdf]
    if (path[2] === SAMPLE_ID && path[3] === "experiments" && path[4]) {
      const isPdf = path[5] === "pdf";

      if (!isPdf && method === "GET" && path.length === 5) {
        return ctx.json(200, templateDetail());
      }
      if (isPdf && method === "GET") {
        return ctx.json(200, {
          template_id: TEMPLATE_ID,
          components: savedComponents,
        });
      }
      if (isPdf && method === "PUT") {
        const body = (await ctx.readBody()) as { components?: unknown[] };
        state.upsertCount += 1;
        state.lastSavedComponents = body.components ?? [];
        // Land on the same version id so the editor doesn't navigate away.
        return ctx.json(200, {
          template_id: TEMPLATE_ID,
          components: state.lastSavedComponents,
        });
      }
    }
  }

  // experiment-manager: the experiment (context) detail used for preview.
  if (
    path[0] === "api" &&
    path[1] === "experiments" &&
    path[2] === CONTEXT_ID &&
    path.length === 3 &&
    method === "GET"
  ) {
    return ctx.json(200, {
      id: CONTEXT_ID,
      values: { client_name: PREVIEW_VALUE },
      calculations: {},
    });
  }

  // ticketing list (the shared `/api/v1` prefix is stripped → ["tickets"]).
  // The editor keeps only tickets whose template matches this lineage.
  if (path[0] === "tickets" && method === "GET" && path.length === 1) {
    return ctx.json(200, [
      {
        id: CONTEXT_ID,
        name: EXPERIMENT_NAME,
        status: "CLOSED",
        experiment_template: { experiment_template_id: LINEAGE_ID },
        created_at: ISO,
        updated_at: ISO,
      },
    ]);
  }

  return false;
}

registerStub({ name: "pdf-builder", reset, handle });
