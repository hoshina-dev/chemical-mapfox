import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  AnswerValue,
  ExperimentTemplate,
  FormAnswers,
  answerFieldIds,
  type Question,
} from "@repo/forms";
import { z } from "zod";

import type { ActionResult } from "@/app/actions/experiment-manager";
import { readTemplate, readValues } from "@/lib/collab/room";
import { getExperimentWorkspace, listExperimentsForStaff } from "@/lib/internal/experiments";
import { logger } from "@/lib/log/logger";
import { grantedScopes } from "@/lib/oauth/scopes";
import type { McpActor } from "@/lib/oauth/store";
import { FORMULA_GUIDE } from "@/lib/staff/formulas";
import { recordLabValues } from "@/lib/staff/labValues";

import { listDocs, readDoc } from "./docs";
import {
  createOnboardingSample,
  getOnboardingTemplate,
  listOnboardingSamples,
  listOnboardingTemplates,
  onboardTemplate,
  setCatalogueVisibility,
  testOnboardingCalculations,
} from "@/lib/staff/onboarding";
import {
  checkInSample,
  closeTicket,
  getReportUrl,
  queueReport,
  runCalculations,
  startExperiment,
  submitExperiment,
} from "@/lib/staff/workflow";
import { ticketsApi } from "@/lib/ticketing/client";
import { statusMeta } from "@/lib/ticketing/tickets";

const STATUSES = ["REQUESTED", "PENDING", "EXPERIMENTING", "FINALIZING", "CLOSED"] as const;

// Tool text is read by the model, which answers the user in their language.
const INSTRUCTIONS = `Lab workspace for ChemFox staff. Experiments move through
REQUESTED (waiting for the sample) → PENDING (sample received) → EXPERIMENTING
(lab form open for measurements) → FINALIZING (calculations + PDF report) → CLOSED.
Use list_experiments to find an experiment and get_experiment to read its lab form
before recording values. Every write acts as the signed-in staff member; confirm
irreversible steps (submit_experiment, close_ticket) with the user first.

record_lab_values takes labForm question ids as keys. Match each value's JSON type
to its question: numbers as numbers (not strings), select/radio as the option
value (not its label), multi-select/checkbox-group/tags as string arrays, date
YYYY-MM-DD, time HH:mm, datetime YYYY-MM-DDTHH:mm, boolean true/false. A
repeatable group's child id takes an array with one entry per repetition. Required
fields are only enforced by submit_experiment.

generate_report runs in the background: poll get_experiment until report.status
is "success" (or "failed"), then use get_report_download_url.

Onboarding a method from a spreadsheet the user gives you (you read the file;
this server cannot): list_samples and list_templates first, get_template to
revise. Question ids are unique snake_case across both forms. onboard_template
creates the sample when the name is new, checks formulas, and writes a plain
PDF layout when the method has none, so clients can request it. To edit a
method, get_template, change it, and pass the result back with its lineageId:
that saves a new version (experiments already requested keep theirs) and keeps
the method's existing PDF layout unless reportLayout is true. publish stays
false unless the user asks to show it on the catalogue;
set_catalogue_visibility shows or hides it later.

How-to guides for this site are available through list_docs and read_doc.
Read the relevant one before explaining a page or workflow to the user, and
link them to it. The question-type reference (staff/question-types) has an
example JSON for every form question type.

Tools you don't see were not granted when the user connected. To change that,
they disconnect the app in Settings → Connected apps and connect again.

${FORMULA_GUIDE}`;

const NEXT_STEP: Record<string, string> = {
  REQUESTED: "Waiting for the sample. Use check_in_sample once it arrives.",
  PENDING: "Sample received. Use start_experiment to open the lab form.",
  EXPERIMENTING:
    "Record measurements with record_lab_values, then submit_experiment when the lab form is complete.",
  FINALIZING:
    "Run run_calculations, then generate_report; close_ticket once the report is ready. record_lab_values can still fix values here.",
  CLOSED: "Closed. Use get_report_download_url for the PDF report.",
};

const contextIdShape = {
  contextId: z.string().min(1).describe("Experiment context id (from list_experiments)."),
};

function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function pickAnswers(questions: Question[], values: FormAnswers): FormAnswers {
  const ids = answerFieldIds(questions);
  return Object.fromEntries(Object.entries(values).filter(([id]) => ids.has(id)));
}

// The staff UI only offers these steps in FINALIZING; experiment-manager doesn't check.
async function requireFinalizing(contextId: string): Promise<CallToolResult | null> {
  let status: string | undefined;
  try {
    status = (await ticketsApi.apiV1TicketsIdGet(contextId)).status;
  } catch {
    return fail(`No experiment found for context id ${contextId}.`);
  }
  return status === "FINALIZING"
    ? null
    : fail(`Only allowed in the FINALIZING stage; this experiment is ${status ?? "unknown"}.`);
}

function fromAction<T>(result: ActionResult<T>, describe: (data: T) => unknown): CallToolResult {
  return result.success ? ok(describe(result.data)) : fail(result.error);
}

export function createStaffMcpServer(actor: McpActor, origin = ""): McpServer {
  // Tools outside the grant are not registered, so the assistant never sees them.
  const scopes = grantedScopes(actor.scope);
  const server = new McpServer(
    { name: "chemfox-lab", version: "1.0.0" },
    { instructions: INSTRUCTIONS },
  );

  // Every call is audited with the human it acts for and the app that made it.
  const audited =
    <A extends Record<string, unknown>>(tool: string, run: (args: A) => Promise<CallToolResult>) =>
    async (args: A): Promise<CallToolResult> => {
      let result: CallToolResult;
      try {
        result = await run(args);
      } catch (err) {
        logger.error({ op: "mcp.tool", tool, userId: actor.userId, clientId: actor.clientId, err }, "mcp tool failed");
        return fail("Something went wrong on the lab server. Try again.");
      }
      logger.info(
        {
          op: "mcp.tool",
          tool,
          userId: actor.userId,
          clientId: actor.clientId,
          clientName: actor.clientName,
          contextId: typeof args.contextId === "string" ? args.contextId : undefined,
          ok: !result.isError,
        },
        "mcp tool call",
      );
      return result;
    };

  server.registerTool(
    "list_experiments",
    {
      title: "List experiments",
      description:
        "List lab experiments, most recently updated first. Filter by status and/or a text query matched against the title, requester and context id.",
      inputSchema: {
        status: z.enum(STATUSES).optional(),
        query: z
          .string()
          .optional()
          .describe(
            "Case-insensitive substring of the experiment title, requester name/email or context id. Intake answers aren't searched.",
          ),
        limit: z.number().int().min(1).max(100).optional().describe("Default 25."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    audited("list_experiments", async ({ status, query, limit }) => {
      const { tickets, enrichmentDegraded } = await listExperimentsForStaff();
      const needle = query?.trim().toLowerCase();
      const rows = tickets
        .filter((t) => !status || t.status === status)
        .filter(
          (t) =>
            !needle ||
            [t.contextId, t.experimentTitle, t.requester?.name, t.requester?.email].some((v) =>
              v?.toLowerCase().includes(needle),
            ),
        );
      return ok({
        total: rows.length,
        requesterInfoMissing: enrichmentDegraded || undefined,
        experiments: rows.slice(0, limit ?? 25).map((t) => ({
          contextId: t.contextId,
          title: t.experimentTitle,
          status: t.status,
          statusLabel: statusMeta(t.status).label,
          requester: t.requester ? { name: t.requester.name, email: t.requester.email } : null,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
      });
    }),
  );

  server.registerTool(
    "get_experiment",
    {
      title: "Get experiment",
      description:
        "Everything about one experiment: ticket stage, requester, the client's intake answers, the lab form questions with their current values, calculations and report status.",
      inputSchema: contextIdShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    audited("get_experiment", async ({ contextId }) => {
      const ws = await getExperimentWorkspace(contextId);
      if (!ws.ticket?.contextId && !ws.state) {
        return fail(`No experiment found for context id ${contextId}.`);
      }
      const status = ws.ticket?.status ?? null;
      let labValues = ws.state?.values ?? {};
      // While experimenting, the collab buffer is newer than experiment-manager.
      if (status === "EXPERIMENTING" && (await readTemplate(contextId))) {
        labValues = await readValues(contextId);
      }
      const state = ws.state;
      return ok({
        contextId,
        title: ws.experimentTitle,
        sampleType: ws.sampleType,
        status,
        statusLabel: status ? statusMeta(status).label : null,
        nextStep: status ? NEXT_STEP[status] : undefined,
        requester: ws.requester ? { name: ws.requester.name, email: ws.requester.email } : null,
        timeline: ws.ticket && {
          createdAt: ws.ticket.createdAt,
          sampleReceivedAt: ws.ticket.sampleReceivedAt,
          experimentStartedAt: ws.ticket.experimentStartedAt,
          resultsSubmittedAt: ws.ticket.resultsSubmittedAt,
          closedAt: ws.ticket.closedAt,
        },
        clientIntake: state && {
          questions: state.template.clientForm.questions,
          answers: pickAnswers(state.template.clientForm.questions, state.values),
        },
        labForm: state && {
          questions: state.template.labForm.questions,
          values: pickAnswers(state.template.labForm.questions, labValues),
        },
        calculations: state?.wireSnapshot.calculations,
        report: state && { status: state.reportStatus, generatedAt: state.reportGeneratedAt },
        warnings: Object.values(ws.errors).length > 0 ? ws.errors : undefined,
      });
    }),
  );

  if (scopes.has("experiments:write")) {
    server.registerTool(
      "record_lab_values",
      {
        title: "Record lab values",
        description:
          "Save lab-form answers (keys are lab form question ids from get_experiment; for a repeatable group, the child id with an array value per repetition). null clears a field. All-or-nothing: if any value is invalid or a colleague is editing that field, nothing is saved. Allowed while EXPERIMENTING (shown live to colleagues) or FINALIZING (fixes; rerun calculations afterwards).",
        inputSchema: {
          ...contextIdShape,
          values: z
            .record(z.string(), AnswerValue)
            .describe("Lab form question id → value; see the server instructions for formats."),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      audited("record_lab_values", async ({ contextId, values }) => {
        if (Object.keys(values).length === 0) return fail("No values given.");
        const res = await recordLabValues(contextId, values, `mcp:${actor.grantId}`);
        return fromAction(res, (data) => ({
          ...data,
          note:
            data.stage === "FINALIZING"
              ? "Saved. Calculation results were cleared; run run_calculations again."
              : "Saved.",
        }));
      }),
    );

    const transitions = [
      {
        name: "check_in_sample",
        title: "Check in sample",
        description: "Mark the physical sample as received (REQUESTED → PENDING).",
        run: checkInSample,
        destructive: false,
      },
      {
        name: "start_experiment",
        title: "Start experiment",
        description: "Open the lab form for measurements (PENDING → EXPERIMENTING).",
        run: startExperiment,
        destructive: false,
      },
      {
        name: "submit_experiment",
        title: "Submit experiment",
        description:
          "Submit the completed lab form (EXPERIMENTING → FINALIZING). Checks every required field and rule first. There is no way back to EXPERIMENTING.",
        run: submitExperiment,
        destructive: true,
      },
      {
        name: "close_ticket",
        title: "Close ticket",
        description:
          "Close a finalized experiment (FINALIZING → CLOSED). Requires calculations and a generated report. Irreversible.",
        run: closeTicket,
        destructive: true,
      },
    ] as const;

    for (const t of transitions) {
      server.registerTool(
        t.name,
        {
          title: t.title,
          description: t.description,
          inputSchema: contextIdShape,
          annotations: { readOnlyHint: false, destructiveHint: t.destructive, openWorldHint: false },
        },
        audited(t.name, async ({ contextId }) =>
          fromAction(await t.run(contextId), (data) => ({ contextId, status: data.status })),
        ),
      );
    }

    server.registerTool(
      "run_calculations",
      {
        title: "Run calculations",
        description: "Evaluate the experiment's formulas against the recorded values (FINALIZING stage). Safe to rerun.",
        inputSchema: contextIdShape,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      audited(
        "run_calculations",
        async ({ contextId }) =>
          (await requireFinalizing(contextId)) ??
          fromAction(await runCalculations(contextId), () => ({
            contextId,
            note: "Calculations finished. Use get_experiment to read the results.",
          })),
      ),
    );

    server.registerTool(
      "generate_report",
      {
        title: "Generate PDF report",
        description:
          "Queue PDF report generation (FINALIZING stage, after run_calculations). It runs in the background; check get_experiment for the report status.",
        inputSchema: contextIdShape,
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      },
      audited(
        "generate_report",
        async ({ contextId }) =>
          (await requireFinalizing(contextId)) ??
          fromAction(await queueReport(contextId), (data) => ({ contextId, reportStatus: data.status })),
      ),
    );
  }

  const sampleIdShape = {
    sampleId: z.string().min(1).describe("Sample id from list_samples."),
  };

  server.registerTool(
    "list_samples",
    {
      title: "List samples",
      description: "Specimen types a method can be onboarded under.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    audited("list_samples", async () => fromAction(await listOnboardingSamples(), (data) => data)),
  );

  server.registerTool(
    "list_templates",
    {
      title: "List templates",
      description:
        "Methods already onboarded for one sample. Use lineageId with onboard_template to revise one instead of creating another.",
      inputSchema: sampleIdShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    audited("list_templates", async ({ sampleId }) =>
      fromAction(await listOnboardingTemplates(sampleId), (data) => data),
    ),
  );

  server.registerTool(
    "get_template",
    {
      title: "Get template",
      description: "One method: both forms, formulas, and whether a PDF layout exists.",
      inputSchema: {
        ...sampleIdShape,
        templateId: z.string().min(1).describe("Template version id from list_templates."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    audited("get_template", async ({ sampleId, templateId }) =>
      fromAction(await getOnboardingTemplate(sampleId, templateId), (data) => data),
    ),
  );

  server.registerTool(
    "test_template_calculations",
    {
      title: "Test template calculations",
      description:
        "Dry-run a draft's formulas the way experiment-manager will, without saving. See the server instructions for the formula language. Stand-in answers fill any question omitted from values.",
      inputSchema: {
        template: ExperimentTemplate,
        values: FormAnswers.optional().describe("Trial answers keyed by question id. Stand-ins fill the rest."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    audited("test_template_calculations", async ({ template, values }) =>
      fromAction(await testOnboardingCalculations(template, values ?? {}), (data) => data),
    ),
  );

  if (scopes.has("templates:write")) {
    server.registerTool(
      "create_sample",
      {
        title: "Create sample",
        description: "Register a specimen type. Prefer onboard_template, which creates the sample when the name is new.",
        inputSchema: {
          name: z.string().min(1),
          description: z.string().optional(),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      },
      audited("create_sample", async ({ name, description }) =>
        fromAction(await createOnboardingSample(name, description), (data) => data),
      ),
    );

    server.registerTool(
      "onboard_template",
      {
        title: "Onboard a method",
        description:
          "Create or revise a method from forms and formulas you extracted from the user's spreadsheet. Checks formulas the way experiment-manager runs them and saves nothing if a formula fails. Writes a plain PDF layout only when the method has none (see reportLayout). Does not publish unless publish is true.",
        inputSchema: {
          sampleId: z.string().optional(),
          sampleName: z.string().optional().describe("Matched case-insensitively. Created when no sample has this name."),
          sampleDescription: z.string().optional(),
          title: z.string().min(1),
          description: z.string().optional(),
          lineageId: z.string().optional().describe("Set to revise this method. Omit to create one."),
          template: ExperimentTemplate,
          trialValues: FormAnswers.optional().describe("Answers to dry-run formulas with. Stand-ins fill the rest."),
          reportLayout: z
          .boolean()
          .optional()
          .describe(
            "Omit to write a plain layout only when the method has none (a revision keeps a designed one). true replaces the layout; false never writes one.",
          ),
          publish: z.boolean().optional().describe("Default false. Also shows the sample on the catalogue."),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      audited("onboard_template", async (args) => fromAction(await onboardTemplate(args), (data) => data)),
    );

    server.registerTool(
      "set_catalogue_visibility",
      {
        title: "Show or hide on the catalogue",
        description:
          "Show or hide a sample, or one method under it (pass lineageId), on the public catalogue. A method only shows when its sample is visible too. Does not create a new template version.",
        inputSchema: {
          ...sampleIdShape,
          lineageId: z.string().optional().describe("Method lineage id from list_templates. Omit to toggle the whole sample."),
          visible: z.boolean(),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      audited("set_catalogue_visibility", async ({ sampleId, lineageId, visible }) =>
        fromAction(await setCatalogueVisibility(sampleId, lineageId, visible), (data) => data),
      ),
    );
  }

  server.registerTool(
    "get_report_download_url",
    {
      title: "Get report download link",
      description: "A short-lived download link for the generated PDF report.",
      inputSchema: contextIdShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    audited("get_report_download_url", async ({ contextId }) =>
      fromAction(await getReportUrl(contextId), (data) => ({ contextId, url: data.url })),
    ),
  );

  server.registerTool(
    "list_docs",
    {
      title: "List help docs",
      description:
        "The site's own how-to guides for staff and clients, plus the question-type reference. Read the relevant one with read_doc before explaining how the site works or authoring a form.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    audited("list_docs", async () =>
      ok(listDocs().map(({ path, ...doc }) => ({ ...doc, url: `${origin}${path}` }))),
    ),
  );

  server.registerTool(
    "read_doc",
    {
      title: "Read a help doc",
      description: "One guide from list_docs as Markdown, ending with a link to the page on the site.",
      inputSchema: { id: z.string().min(1).describe("Doc id from list_docs, e.g. staff/onboarding.") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    audited("read_doc", async ({ id }) => {
      const doc = readDoc(id, origin);
      return doc ? { content: [{ type: "text", text: doc }] } : fail(`No doc ${id}. Use list_docs.`);
    }),
  );

  return server;
}
