import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  AnswerValue,
  answerFieldIds,
  ExperimentTemplate,
  FormAnswers,
  type Question,
} from "@repo/forms";
import { z } from "zod";

import type { ActionResult } from "@/app/actions/onboarding";
import { readTemplate, readValues } from "@/lib/collab/room";
import { statusMeta } from "@/lib/experiment/tickets";
import { getExperimentWorkspace, listExperimentsForStaff } from "@/lib/internal/experiments";
import { experimentReportDownloadPath } from "@/lib/internal/routes";
import { logger } from "@/lib/log/logger";
import { grantedScopes } from "@/lib/oauth/scopes";
import type { McpActor } from "@/lib/oauth/store";
import {
  createSampleType,
  getTemplate,
  getTicket,
  listSampleTypes,
  listTemplates,
  experimentManagerMessage,
} from "@/lib/experiment-manager/client";
import { collabRoomId, templateToLoaded } from "@/lib/experiment-manager/mappers";
import { FORMULA_GUIDE } from "@/lib/staff/formulas";
import { recordLabValues } from "@/lib/staff/labValues";
import { checkIn, close, start } from "@/lib/staff/lifecycle";
import { onboardTemplate, refreshOnboarding, setCatalogueVisibility } from "@/lib/staff/onboarding";

import { listDocs, readDoc } from "./docs";

const STATUSES = ["REQUESTED", "RECEIVED", "IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED"] as const;

// Tool text is read by the model, which answers the user in their language.
const INSTRUCTIONS = `Lab workspace for ChemFox staff. A ticket is one sample with one
experiment per requested method. Tickets move through REQUESTED (waiting for the
sample) → RECEIVED (sample checked in) → IN_PROGRESS (methods started) →
COMPLETED (every method finished) → CLOSED, or CANCELLED. Each experiment is
PENDING → IN_PROGRESS → FINISHED.
Use list_experiments to find a ticket and get_experiment to read it (its
experiments and the lab form of one) before recording values. Every write acts
as the signed-in staff member; confirm close_ticket (irreversible) with the user first.

You never run calculations. A staff member finishes each experiment in the
browser, which runs its formulas, and publishes the report there too.

record_lab_values takes labForm question ids as keys. Match each value's JSON type
to its question: numbers as numbers (not strings), select/radio as the option
value (not its label), multi-select/checkbox-group/tags as string arrays, date
YYYY-MM-DD, time HH:mm, datetime YYYY-MM-DDTHH:mm, boolean true/false. A
repeatable group's child id takes an array with one entry per repetition.
Required fields are only enforced when the experiment is finished.

Onboarding a method from a spreadsheet the user gives you (you read the file;
this server cannot): list_samples and list_templates first, get_template to
revise. Question ids are unique snake_case across both forms. onboard_template
creates the sample when the name is new and checks formulas without running
them; ask the user to test them on the method's builder page. To edit a
method, get_template, change it, and pass the result back with its templateId:
experiments already requested keep their own copy. publish stays false unless
the user asks to show it on the catalogue; set_catalogue_visibility shows or
hides it later. The report form (blank PDF + field map) is uploaded on the site.

How-to guides for this site are available through list_docs and read_doc.
Read the relevant one before explaining a page or workflow to the user, and
link them to it. The question-type reference (staff/question-types) has an
example JSON for every form question type.

Tools you don't see were not granted when the user connected. To change that,
they disconnect the app in Settings → Connected apps and connect again.

${FORMULA_GUIDE}`;

const NEXT_STEP: Record<(typeof STATUSES)[number], string> = {
  REQUESTED: "Waiting for the sample. Use check_in_sample once it arrives.",
  RECEIVED: "Sample checked in. Use start_experiment for each method.",
  IN_PROGRESS:
    "Record measurements with record_lab_values on started experiments. Staff finish each one in the browser.",
  COMPLETED: "Every method is finished. Staff publish the report in the browser; close_ticket when done.",
  CLOSED: "Closed. get_report_download_url gives the report once it is published.",
  CANCELLED: "Cancelled. Nothing more to do.",
};

const contextIdShape = {
  contextId: z.string().min(1).describe("Ticket id (from list_experiments)."),
};
const experimentIdShape = {
  experimentId: z.string().min(1).describe("Experiment id (from get_experiment's experiments)."),
};
const sampleIdShape = {
  sampleId: z.string().min(1).describe("Sample id from list_samples."),
};

function ok(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function fromAction<T>(result: ActionResult<T>, describe: (data: T) => unknown): CallToolResult {
  return result.success ? ok(describe(result.data)) : fail(result.error);
}

function pickAnswers(questions: Question[], values: FormAnswers): FormAnswers {
  const ids = answerFieldIds(questions);
  return Object.fromEntries(Object.entries(values).filter(([id]) => ids.has(id)));
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
        return fail(experimentManagerMessage(err, "Something went wrong on the lab server. Try again."));
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
        "List lab tickets, most recently updated first. Filter by status and/or a text query matched against the title, requester and ticket id.",
      inputSchema: {
        status: z.enum(STATUSES).optional(),
        query: z
          .string()
          .optional()
          .describe(
            "Case-insensitive substring of the ticket title, requester name/email or ticket id. Intake answers aren't searched.",
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
        "One ticket: its stage, requester, experiments (one per method), and for one experiment the client's intake answers, the lab form questions with their current values and the calculation results. Without experimentId, the first experiment not yet finished.",
      inputSchema: { ...contextIdShape, experimentId: experimentIdShape.experimentId.optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    audited("get_experiment", async ({ contextId, experimentId }) => {
      const ws = await getExperimentWorkspace(contextId, experimentId);
      if (!ws.ticket) return fail(`No ticket found with id ${contextId}.`);
      const selected = ws.selected;
      if (experimentId && selected?.id !== experimentId) {
        return fail(`Experiment ${experimentId} is not on ticket ${contextId}.`);
      }
      const status = ws.ticket.status;
      let labValues = selected?.state.values ?? {};
      // While its method is in progress, the collab room is newer than what is stored.
      if (selected?.status === "IN_PROGRESS") {
        const room = collabRoomId(contextId, selected.id);
        if (await readTemplate(room)) labValues = await readValues(room);
      }
      const state = selected?.state;
      return ok({
        contextId,
        title: ws.experimentTitle,
        sampleType: ws.sampleType,
        status,
        statusLabel: statusMeta(status).label,
        nextStep: NEXT_STEP[status as (typeof STATUSES)[number]],
        requester: ws.requester ? { name: ws.requester.name, email: ws.requester.email } : null,
        timeline: {
          createdAt: ws.ticket.createdAt,
          sampleReceivedAt: ws.ticket.sampleReceivedAt,
          experimentStartedAt: ws.ticket.experimentStartedAt,
          resultsSubmittedAt: ws.ticket.resultsSubmittedAt,
          closedAt: ws.ticket.closedAt,
        },
        reportPublishedAt: ws.raw?.reportPublishedAt ?? null,
        experiments: ws.experiments.map((e) => ({ id: e.id, method: e.name, status: e.status })),
        experiment: selected &&
          state && {
            id: selected.id,
            method: selected.name,
            status: selected.status,
            clientIntake: {
              questions: state.template.clientForm.questions,
              answers: pickAnswers(state.template.clientForm.questions, state.values),
            },
            labForm: {
              questions: state.template.labForm.questions,
              values: pickAnswers(state.template.labForm.questions, labValues),
            },
            calculations: state.wireSnapshot.calculations,
          },
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
          "Save lab-form answers of one IN_PROGRESS experiment (keys are lab form question ids from get_experiment; for a repeatable group, the child id with an array value per repetition). null clears a field. Shown live to colleagues with the form open. All-or-nothing: if any value is invalid or a colleague is editing that field, nothing is saved.",
        inputSchema: {
          ...contextIdShape,
          ...experimentIdShape,
          values: z
            .record(z.string(), AnswerValue)
            .describe("Lab form question id → value; see the server instructions for formats."),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      audited("record_lab_values", async ({ contextId, experimentId, values }) => {
        if (Object.keys(values).length === 0) return fail("No values given.");
        const editor = { userId: actor.userId, connectionId: `mcp:${actor.grantId}` };
        return fromAction(await recordLabValues(editor, contextId, experimentId, values), (data) => ({
          ...data,
          note: "Saved. A staff member finishes the experiment in the browser.",
        }));
      }),
    );

    // The ticket's status after a step, read back from experiment-manager.
    const statusAfter = async (contextId: string) => ({
      contextId,
      status: (await getTicket(actor.userId, contextId)).status,
    });

    server.registerTool(
      "check_in_sample",
      {
        title: "Check in sample",
        description: "Mark the physical sample as received (REQUESTED → RECEIVED).",
        inputSchema: contextIdShape,
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      },
      audited("check_in_sample", async ({ contextId }) => {
        const res = await checkIn(actor.userId, contextId);
        return res.success ? ok(await statusAfter(contextId)) : fail(res.error);
      }),
    );

    server.registerTool(
      "start_experiment",
      {
        title: "Start experiment",
        description: "Open one method's lab form for measurements (PENDING → IN_PROGRESS). The sample must be checked in.",
        inputSchema: { ...contextIdShape, ...experimentIdShape },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      },
      audited("start_experiment", async ({ contextId, experimentId }) => {
        const res = await start(actor.userId, contextId, experimentId);
        return res.success ? ok(await statusAfter(contextId)) : fail(res.error);
      }),
    );

    server.registerTool(
      "close_ticket",
      {
        title: "Close ticket",
        description: "Close a COMPLETED ticket (every method finished). Irreversible.",
        inputSchema: contextIdShape,
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      },
      audited("close_ticket", async ({ contextId }) => {
        const res = await close(actor.userId, contextId);
        return res.success ? ok(await statusAfter(contextId)) : fail(res.error);
      }),
    );
  }

  server.registerTool(
    "get_report_download_url",
    {
      title: "Get report download link",
      description:
        "Link to the ticket's PDF report, once a staff member published it. It opens on the site, signed in as staff.",
      inputSchema: contextIdShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    audited("get_report_download_url", async ({ contextId }) => {
      const ticket = await getTicket(actor.userId, contextId);
      if (!ticket.reportPublishedAt) {
        return fail("The report is not published yet. A staff member publishes it in the browser.");
      }
      return ok({ contextId, url: `${origin}${experimentReportDownloadPath(contextId)}` });
    }),
  );

  server.registerTool(
    "list_samples",
    {
      title: "List samples",
      description: "Sample types a method can be onboarded under, in catalogue order.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    audited("list_samples", async () =>
      ok(
        (await listSampleTypes(actor.userId)).map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          visible: s.isVisibleOnWeb,
          hasReportForm: s.reportForm !== null,
        })),
      ),
    ),
  );

  server.registerTool(
    "list_templates",
    {
      title: "List templates",
      description:
        "Methods already onboarded for one sample. Pass templateId to onboard_template to revise one instead of creating another.",
      inputSchema: sampleIdShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    audited("list_templates", async ({ sampleId }) =>
      ok(
        (await listTemplates(actor.userId, sampleId)).map((t) => ({
          templateId: t.id,
          title: t.name,
          description: t.description,
          visible: t.isVisibleOnWeb,
        })),
      ),
    ),
  );

  server.registerTool(
    "get_template",
    {
      title: "Get template",
      description: "One method: both forms and its formulas.",
      inputSchema: { templateId: z.string().min(1).describe("Template id from list_templates.") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    audited("get_template", async ({ templateId }) => {
      const raw = await getTemplate(actor.userId, templateId);
      const { template, meta } = templateToLoaded(raw);
      return ok({
        templateId: raw.id,
        sampleId: raw.sampleTypeId,
        title: meta.title,
        description: meta.description ?? null,
        visible: raw.isVisibleOnWeb,
        template: {
          clientForm: template.clientForm,
          labForm: template.labForm,
          calculations: Object.fromEntries(
            Object.entries(template.calculations).map(([name, { formula }]) => [name, { formula }]),
          ),
        },
      });
    }),
  );

  if (scopes.has("templates:write")) {
    server.registerTool(
      "create_sample",
      {
        title: "Create sample",
        description:
          "Register a sample type (hidden from the catalogue until shown). Prefer onboard_template, which creates the sample when the name is new.",
        inputSchema: {
          name: z.string().min(1),
          description: z.string().optional(),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      },
      audited("create_sample", async ({ name, description }) => {
        const trimmed = name.trim();
        if (!trimmed) return fail("Sample name is required.");
        const sample = await createSampleType(actor.userId, {
          name: trimmed,
          description: description?.trim() || null,
        });
        refreshOnboarding(sample.id);
        return ok({ id: sample.id, name: sample.name });
      }),
    );

    server.registerTool(
      "onboard_template",
      {
        title: "Onboard a method",
        description:
          "Create or revise a method from forms and formulas you extracted from the user's spreadsheet. Formulas are checked without running them (unknown names, cycles, bad question ids); saves nothing if that check fails. Does not show it on the catalogue unless publish is true.",
        inputSchema: {
          sampleId: z.string().optional(),
          sampleName: z
            .string()
            .optional()
            .describe("Matched case-insensitively. Created when no sample has this name."),
          sampleDescription: z.string().optional(),
          title: z.string().min(1),
          description: z.string().optional(),
          templateId: z.string().optional().describe("Set to revise this method. Omit to create one."),
          template: ExperimentTemplate,
          publish: z
            .boolean()
            .optional()
            .describe("Default false. Also shows the sample and the method on the catalogue."),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      audited("onboard_template", async (args) => fromAction(await onboardTemplate(actor.userId, args), (data) => data)),
    );

    server.registerTool(
      "set_catalogue_visibility",
      {
        title: "Show or hide on the catalogue",
        description:
          "Show or hide a sample, or one method under it (pass templateId), on the public catalogue. A method only shows when its sample is visible too.",
        inputSchema: {
          ...sampleIdShape,
          templateId: z.string().optional().describe("Method id from list_templates. Omit to toggle the whole sample."),
          visible: z.boolean(),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      audited("set_catalogue_visibility", async ({ sampleId, templateId, visible }) =>
        fromAction(await setCatalogueVisibility(actor.userId, sampleId, templateId, visible), () => ({
          sampleId,
          templateId,
          visible,
        })),
      ),
    );
  }

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
