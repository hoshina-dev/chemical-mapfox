import "server-only";
// TODO(MCP rework): only the read tools are left (list_experiments, get_experiment,
// list_docs, read_doc). The write tools went with ticketing-service and
// experiment-manager; rebuild them on lib/sample-tracker (see the TODO there).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { answerFieldIds, FormAnswers, type Question } from "@repo/forms";
import { z } from "zod";

import { readTemplate, readValues } from "@/lib/collab/room";
import { statusMeta } from "@/lib/experiment/tickets";
import { getExperimentWorkspace, listExperimentsForStaff } from "@/lib/internal/experiments";
import { logger } from "@/lib/log/logger";
import type { McpActor } from "@/lib/oauth/store";
import { collabRoomId } from "@/lib/sample-tracker/mappers";

import { listDocs, readDoc } from "./docs";

const STATUSES = ["REQUESTED", "RECEIVED", "IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED"] as const;

// Tool text is read by the model, which answers the user in their language.
const INSTRUCTIONS = `Lab workspace for ChemFox staff (read-only for now). A ticket is one
sample with one experiment per requested method. Tickets move through REQUESTED
(waiting for the sample) → RECEIVED (sample checked in) → IN_PROGRESS (methods
started) → COMPLETED (every method finished) → CLOSED, or CANCELLED.
Use list_experiments to find a ticket and get_experiment to read it.

How-to guides for this site are available through list_docs and read_doc.
Read the relevant one before explaining a page or workflow to the user, and
link them to it. The question-type reference (staff/question-types) has an
example JSON for every form question type.`;

const contextIdShape = {
  contextId: z.string().min(1).describe("Ticket id (from list_experiments)."),
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

export function createStaffMcpServer(actor: McpActor, origin = ""): McpServer {
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
      // While its method is in progress, the collab room is newer than what is stored.
      const selected = ws.selected;
      if (selected?.status === "IN_PROGRESS") {
        const room = collabRoomId(contextId, selected.id);
        if (await readTemplate(room)) labValues = await readValues(room);
      }
      const state = ws.state;
      return ok({
        contextId,
        title: ws.experimentTitle,
        sampleType: ws.sampleType,
        status,
        statusLabel: status ? statusMeta(status).label : null,
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
