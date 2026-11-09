import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/internal/experiments", () => ({
  listExperimentsForStaff: vi.fn(),
  getExperimentWorkspace: vi.fn(),
}));
vi.mock("@/lib/staff/workflow", () => ({
  checkInSample: vi.fn(),
  closeTicket: vi.fn(),
  getReportUrl: vi.fn(),
  queueReport: vi.fn(),
  runCalculations: vi.fn(),
  startExperiment: vi.fn(),
  submitExperiment: vi.fn(),
}));
vi.mock("@/lib/staff/labValues", () => ({
  recordLabValues: vi.fn(),
}));
vi.mock("@/lib/staff/onboarding", () => ({
  listOnboardingSamples: vi.fn(),
  listOnboardingTemplates: vi.fn(),
  getOnboardingTemplate: vi.fn(),
  createOnboardingSample: vi.fn(),
  testOnboardingCalculations: vi.fn(),
  onboardTemplate: vi.fn(),
}));
vi.mock("@/lib/collab/room", () => ({
  readTemplate: vi.fn(),
  readValues: vi.fn(),
}));
vi.mock("@/lib/ticketing/client", () => ({
  ticketsApi: { apiV1TicketsIdGet: vi.fn() },
}));
vi.mock("@/lib/log/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { readTemplate, readValues } from "@/lib/collab/room";
import {
  getExperimentWorkspace,
  listExperimentsForStaff,
} from "@/lib/internal/experiments";
import type { ExperimentWorkspace } from "@/lib/internal/experiments";
import { logger } from "@/lib/log/logger";
import type { McpActor } from "@/lib/oauth/store";
import { recordLabValues } from "@/lib/staff/labValues";
import {
  createOnboardingSample,
  getOnboardingTemplate,
  listOnboardingSamples,
  listOnboardingTemplates,
  onboardTemplate,
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
import type { ExperimentTicket } from "@/lib/ticketing/tickets";
import type { ExperimentState } from "@/lib/experiment-manager/mappers";
import type { EnrichedTicket } from "@/lib/internal/experiments";

import { createStaffMcpServer } from "./server";

const actor: McpActor = {
  grantId: "grant-1",
  clientId: "client-chatgpt",
  clientName: "ChatGPT",
  userId: "staff-ada",
  name: "Ada",
  email: "ada@lab.test",
  scope: "staff",
  resource: null,
};

const TOOL_NAMES = [
  "list_experiments",
  "get_experiment",
  "record_lab_values",
  "check_in_sample",
  "start_experiment",
  "submit_experiment",
  "close_ticket",
  "run_calculations",
  "generate_report",
  "list_samples",
  "list_templates",
  "get_template",
  "create_sample",
  "test_template_calculations",
  "onboard_template",
  "get_report_download_url",
] as const;

function ticket(status: string, overrides: Partial<ExperimentTicket> = {}): ExperimentTicket {
  return {
    contextId: "ctx-1",
    name: "Water pH",
    status,
    templateId: "t1",
    organizationId: "org",
    userId: "u2",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    sampleReceivedAt: "2026-01-01T12:00:00Z",
    experimentStartedAt: "2026-01-01T13:00:00Z",
    resultsSubmittedAt: null,
    closedAt: null,
    closedReason: null,
    ...overrides,
  };
}

function enriched(
  status: string,
  overrides: Partial<EnrichedTicket> = {},
): EnrichedTicket {
  const base = ticket(status, overrides);
  return {
    ...base,
    sampleType: "Water",
    experimentTitle: overrides.experimentTitle ?? base.name,
    requester:
      overrides.requester === undefined
        ? { id: "u2", name: "Bob", email: "bob@lab.test", avatarUrl: null }
        : overrides.requester,
  };
}

const labQuestions = [
  { id: "ph", type: "number" as const, label: "pH", config: { min: 0, max: 14 } },
];
const clientQuestions = [
  { id: "sample_id", type: "string" as const, label: "Sample ID" },
];

function state(overrides: Partial<ExperimentState> = {}): ExperimentState {
  const template = {
    clientForm: { name: "Client", questions: clientQuestions },
    labForm: { name: "Lab", questions: labQuestions },
    calculations: { mean_ph: { formula: "mean(values['ph'])" } },
  };
  return {
    id: "ctx-1",
    sampleId: "s1",
    templateId: "t1",
    reportStatus: null,
    reportGeneratedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    template,
    wireSnapshot: {
      clientForm: template.clientForm,
      labForm: template.labForm,
      calculations: { mean_ph: { formula: "mean(values['ph'])" } },
    },
    valid: true,
    values: { ph: 7, sample_id: "W-1" },
    ...overrides,
  };
}

function workspace(
  overrides: Partial<ExperimentWorkspace> = {},
): ExperimentWorkspace {
  return {
    contextId: "ctx-1",
    ticket: ticket("EXPERIMENTING"),
    requester: { id: "u2", name: "Bob", email: "bob@lab.test", avatarUrl: null },
    sampleType: "Water",
    experimentTitle: "Water pH",
    state: state(),
    errors: {},
    ...overrides,
  };
}

type Connected = { client: Client; close: () => Promise<void> };

async function connect(who: McpActor = actor): Promise<Connected> {
  const server = createStaffMcpServer(who);
  const client = new Client({ name: "vitest", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

function textOf(result: { content: { type: string; text?: string }[]; isError?: boolean }) {
  const block = result.content[0];
  expect(block?.type).toBe("text");
  return block?.text ?? "";
}

function parseOk(result: { content: { type: string; text?: string }[]; isError?: boolean }) {
  expect(result.isError ?? false).toBe(false);
  return JSON.parse(textOf(result)) as Record<string, unknown>;
}

let session: Connected;

beforeEach(async () => {
  vi.mocked(listExperimentsForStaff).mockReset();
  vi.mocked(getExperimentWorkspace).mockReset();
  vi.mocked(recordLabValues).mockReset();
  vi.mocked(readTemplate).mockReset();
  vi.mocked(readValues).mockReset();
  vi.mocked(checkInSample).mockReset();
  vi.mocked(startExperiment).mockReset();
  vi.mocked(submitExperiment).mockReset();
  vi.mocked(closeTicket).mockReset();
  vi.mocked(runCalculations).mockReset();
  vi.mocked(queueReport).mockReset();
  vi.mocked(getReportUrl).mockReset();
  vi.mocked(listOnboardingSamples).mockReset();
  vi.mocked(listOnboardingTemplates).mockReset();
  vi.mocked(getOnboardingTemplate).mockReset();
  vi.mocked(createOnboardingSample).mockReset();
  vi.mocked(testOnboardingCalculations).mockReset();
  vi.mocked(onboardTemplate).mockReset();
  vi.mocked(ticketsApi.apiV1TicketsIdGet).mockReset();
  vi.mocked(logger.info).mockReset();
  vi.mocked(logger.error).mockReset();
  session = await connect();
});

afterEach(async () => {
  await session.close();
});

describe("createStaffMcpServer", () => {
  it("lists every tool with the advertised annotations", async () => {
    const listed = await session.client.listTools();
    expect(listed.tools.map((t) => t.name)).toEqual([...TOOL_NAMES]);

    const byName = Object.fromEntries(listed.tools.map((t) => [t.name, t.annotations]));
    expect(byName.list_experiments).toMatchObject({ readOnlyHint: true });
    expect(byName.get_experiment).toMatchObject({ readOnlyHint: true });
    expect(byName.get_report_download_url).toMatchObject({ readOnlyHint: true });
    expect(byName.record_lab_values).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
    expect(byName.check_in_sample).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    });
    expect(byName.start_experiment).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    });
    expect(byName.submit_experiment).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
    expect(byName.close_ticket).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
    expect(byName.run_calculations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    });
    expect(byName.generate_report).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    });
  });

  it("rejects a bad status enum as an input-validation error", async () => {
    const result = await session.client.callTool({
      name: "list_experiments",
      arguments: { status: "NOPE" },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(
      /Invalid arguments for tool list_experiments/,
    );
    expect(logger.info).not.toHaveBeenCalled();
  });
});

describe("list_experiments", () => {
  const tickets: EnrichedTicket[] = [
    enriched("EXPERIMENTING", {
      contextId: "ctx-water",
      experimentTitle: "Water pH",
    }),
    enriched("PENDING", {
      contextId: "ctx-soil",
      name: "Soil metals",
      experimentTitle: "Soil metals",
      requester: null,
    }),
    enriched("FINALIZING", {
      contextId: "ctx-air",
      name: "Air quality",
      experimentTitle: "Air quality",
      requester: {
        id: "u3",
        name: "Alice",
        email: "alice@lab.test",
        avatarUrl: null,
      },
    }),
  ];

  it("filters by status and query, keeps a null requester, and flags degraded enrichment", async () => {
    vi.mocked(listExperimentsForStaff).mockResolvedValue({
      tickets,
      enrichmentDegraded: true,
    });

    const byStatus = parseOk(
      await session.client.callTool({
        name: "list_experiments",
        arguments: { status: "PENDING" },
      }),
    );
    expect(byStatus.total).toBe(1);
    expect(byStatus.requesterInfoMissing).toBe(true);
    expect(byStatus.experiments).toEqual([
      expect.objectContaining({
        contextId: "ctx-soil",
        title: "Soil metals",
        status: "PENDING",
        statusLabel: "Sample received",
        requester: null,
      }),
    ]);

    const byName = parseOk(
      await session.client.callTool({
        name: "list_experiments",
        arguments: { query: "  alice  " },
      }),
    );
    expect(byName.total).toBe(1);
    expect((byName.experiments as { contextId: string }[])[0]?.contextId).toBe(
      "ctx-air",
    );

    const byEmail = parseOk(
      await session.client.callTool({
        name: "list_experiments",
        arguments: { query: "BOB@LAB.TEST" },
      }),
    );
    expect(byEmail.total).toBe(1);
    expect((byEmail.experiments as { contextId: string }[])[0]?.contextId).toBe(
      "ctx-water",
    );

    const byId = parseOk(
      await session.client.callTool({
        name: "list_experiments",
        arguments: { query: "ctx-soil" },
      }),
    );
    expect(byId.total).toBe(1);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        op: "mcp.tool",
        tool: "list_experiments",
        userId: actor.userId,
        clientId: actor.clientId,
        clientName: actor.clientName,
        contextId: undefined,
        ok: true,
      }),
      "mcp tool call",
    );
  });

  it("caps the page at the given limit (default 25) and omits the degraded flag when healthy", async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      enriched("REQUESTED", {
        contextId: `ctx-${i}`,
        experimentTitle: `Run ${i}`,
        requester: null,
      }),
    );
    vi.mocked(listExperimentsForStaff).mockResolvedValue({
      tickets: many,
      enrichmentDegraded: false,
    });

    const defaults = parseOk(
      await session.client.callTool({ name: "list_experiments", arguments: {} }),
    );
    expect(defaults.total).toBe(30);
    expect(defaults.requesterInfoMissing).toBeUndefined();
    expect(defaults.experiments).toHaveLength(25);

    const limited = parseOk(
      await session.client.callTool({
        name: "list_experiments",
        arguments: { limit: 2 },
      }),
    );
    expect(limited.total).toBe(30);
    expect(limited.experiments).toHaveLength(2);
  });

  it("treats a whitespace-only query as unfiltered", async () => {
    vi.mocked(listExperimentsForStaff).mockResolvedValue({
      tickets: [enriched("CLOSED", { contextId: "ctx-done" })],
      enrichmentDegraded: false,
    });

    const listed = parseOk(
      await session.client.callTool({
        name: "list_experiments",
        arguments: { query: "   " },
      }),
    );
    expect(listed.total).toBe(1);
  });
});

describe("get_experiment", () => {
  it("fails when neither ticket nor state exists", async () => {
    vi.mocked(getExperimentWorkspace).mockResolvedValue(
      workspace({ ticket: null, state: null }),
    );

    const result = await session.client.callTool({
      name: "get_experiment",
      arguments: { contextId: "missing" },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("No experiment found for context id missing.");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "get_experiment",
        contextId: "missing",
        ok: false,
      }),
      "mcp tool call",
    );
  });

  it("fails when the ticket has no contextId and there is no state", async () => {
    vi.mocked(getExperimentWorkspace).mockResolvedValue(
      workspace({
        ticket: ticket("REQUESTED", { contextId: "" }),
        state: null,
      }),
    );

    const result = await session.client.callTool({
      name: "get_experiment",
      arguments: { contextId: "unknown" },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("No experiment found for context id unknown.");
  });

  it("overlays live collab-buffer values while EXPERIMENTING and a template is hydrated", async () => {
    vi.mocked(getExperimentWorkspace).mockResolvedValue(workspace());
    vi.mocked(readTemplate).mockResolvedValue({ labForm: { questions: [] } } as never);
    vi.mocked(readValues).mockResolvedValue({ ph: 8.1 });

    const body = parseOk(
      await session.client.callTool({
        name: "get_experiment",
        arguments: { contextId: "ctx-1" },
      }),
    );
    expect(body).toMatchObject({
      contextId: "ctx-1",
      title: "Water pH",
      sampleType: "Water",
      status: "EXPERIMENTING",
      statusLabel: "In progress",
      nextStep:
        "Record measurements with record_lab_values, then submit_experiment when the lab form is complete.",
      requester: { name: "Bob", email: "bob@lab.test" },
    });
    expect(body.labForm).toMatchObject({ values: { ph: 8.1 } });
    expect(body.clientIntake).toMatchObject({
      answers: { sample_id: "W-1" },
    });
    expect(body.warnings).toBeUndefined();
    expect(readValues).toHaveBeenCalledWith("ctx-1");
  });

  it("keeps experiment-manager values when the EXPERIMENTING room is not hydrated", async () => {
    vi.mocked(getExperimentWorkspace).mockResolvedValue(workspace());
    vi.mocked(readTemplate).mockResolvedValue(null);

    const body = parseOk(
      await session.client.callTool({
        name: "get_experiment",
        arguments: { contextId: "ctx-1" },
      }),
    );
    expect(body.labForm).toMatchObject({ values: { ph: 7 } });
    expect(readValues).not.toHaveBeenCalled();
  });

  it("does not read the collab buffer outside EXPERIMENTING", async () => {
    vi.mocked(getExperimentWorkspace).mockResolvedValue(
      workspace({ ticket: ticket("FINALIZING") }),
    );

    const body = parseOk(
      await session.client.callTool({
        name: "get_experiment",
        arguments: { contextId: "ctx-1" },
      }),
    );
    expect(body.status).toBe("FINALIZING");
    expect(body.nextStep).toContain("run_calculations");
    expect(readTemplate).not.toHaveBeenCalled();
    expect(readValues).not.toHaveBeenCalled();
  });

  it("surfaces warnings, a missing requester, and ticket-only / state-only shapes", async () => {
    vi.mocked(getExperimentWorkspace).mockResolvedValue(
      workspace({
        ticket: ticket("REQUESTED"),
        requester: null,
        errors: { ticket: "slow", state: "missing" },
      }),
    );

    const withWarnings = parseOk(
      await session.client.callTool({
        name: "get_experiment",
        arguments: { contextId: "ctx-1" },
      }),
    );
    expect(withWarnings.requester).toBeNull();
    expect(withWarnings.warnings).toEqual({ ticket: "slow", state: "missing" });
    expect(withWarnings.nextStep).toBe(
      "Waiting for the sample. Use check_in_sample once it arrives.",
    );

    vi.mocked(getExperimentWorkspace).mockResolvedValue(
      workspace({ ticket: null, state: state(), experimentTitle: "Orphan" }),
    );
    const stateOnly = parseOk(
      await session.client.callTool({
        name: "get_experiment",
        arguments: { contextId: "ctx-1" },
      }),
    );
    expect(stateOnly.status).toBeNull();
    expect(stateOnly.statusLabel).toBeNull();
    expect(stateOnly.nextStep).toBeUndefined();
    expect(stateOnly.timeline).toBeNull();

    vi.mocked(getExperimentWorkspace).mockResolvedValue(
      workspace({ ticket: ticket("CLOSED"), state: null }),
    );
    const ticketOnly = parseOk(
      await session.client.callTool({
        name: "get_experiment",
        arguments: { contextId: "ctx-1" },
      }),
    );
    expect(ticketOnly.nextStep).toBe(
      "Closed. Use get_report_download_url for the PDF report.",
    );
    expect(ticketOnly.labForm).toBeNull();
    expect(ticketOnly.clientIntake).toBeNull();
    expect(ticketOnly.report).toBeNull();
    expect(ticketOnly.calculations).toBeUndefined();
  });

  it("returns the PENDING next-step copy", async () => {
    vi.mocked(getExperimentWorkspace).mockResolvedValue(
      workspace({ ticket: ticket("PENDING") }),
    );
    const body = parseOk(
      await session.client.callTool({
        name: "get_experiment",
        arguments: { contextId: "ctx-1" },
      }),
    );
    expect(body.nextStep).toBe(
      "Sample received. Use start_experiment to open the lab form.",
    );
  });

  it("keeps client answers out of labForm.values and lab answers (including repeatable children) out of clientIntake", async () => {
    const labFormQuestions = [
      { id: "ph", type: "number" as const, label: "pH", config: { min: 0, max: 14 } },
      {
        id: "replicates",
        type: "repeatable-group" as const,
        label: "Replicates",
        config: {
          count: 2,
          questions: [{ id: "reading", type: "number" as const, label: "Reading" }],
        },
      },
    ];
    vi.mocked(getExperimentWorkspace).mockResolvedValue(
      workspace({
        ticket: ticket("FINALIZING"),
        state: state({
          template: {
            clientForm: { name: "Client", questions: clientQuestions },
            labForm: { name: "Lab", questions: labFormQuestions },
            calculations: {},
          },
          values: {
            sample_id: "W-1",
            ph: 7,
            reading: [1.1, 1.2],
            replicates: "group-id-is-not-an-answer",
          },
        }),
      }),
    );

    const body = parseOk(
      await session.client.callTool({
        name: "get_experiment",
        arguments: { contextId: "ctx-1" },
      }),
    );
    expect(body.clientIntake).toEqual({
      questions: clientQuestions,
      answers: { sample_id: "W-1" },
    });
    expect(body.labForm).toEqual({
      questions: labFormQuestions,
      values: { ph: 7, reading: [1.1, 1.2] },
    });
  });
});

describe("record_lab_values", () => {
  it("rejects an empty values object without calling the writer", async () => {
    const result = await session.client.callTool({
      name: "record_lab_values",
      arguments: { contextId: "ctx-1", values: {} },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("No values given.");
    expect(recordLabValues).not.toHaveBeenCalled();
  });

  it("passes mcp:<grantId> as the connection id and notes a FINALIZING save", async () => {
    vi.mocked(recordLabValues).mockResolvedValue({
      success: true,
      data: { stage: "FINALIZING", saved: ["ph"] },
    });

    const body = parseOk(
      await session.client.callTool({
        name: "record_lab_values",
        arguments: { contextId: "ctx-1", values: { ph: 8 } },
      }),
    );
    expect(recordLabValues).toHaveBeenCalledWith("ctx-1", { ph: 8 }, "mcp:grant-1");
    expect(body).toEqual({
      stage: "FINALIZING",
      saved: ["ph"],
      note: "Saved. Calculation results were cleared; run run_calculations again.",
    });
  });

  it("notes a live EXPERIMENTING save", async () => {
    vi.mocked(recordLabValues).mockResolvedValue({
      success: true,
      data: { stage: "EXPERIMENTING", saved: ["ph", "note"] },
    });

    const body = parseOk(
      await session.client.callTool({
        name: "record_lab_values",
        arguments: {
          contextId: "ctx-1",
          values: { ph: 8, note: null },
        },
      }),
    );
    expect(body.note).toBe("Saved.");
  });

  it("passes the writer error through as isError", async () => {
    vi.mocked(recordLabValues).mockResolvedValue({
      success: false,
      error: "Nothing was saved.\nph: Ada is editing this field right now; try again shortly.",
    });

    const result = await session.client.callTool({
      name: "record_lab_values",
      arguments: { contextId: "ctx-1", values: { ph: 8 } },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Nothing was saved.");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ tool: "record_lab_values", ok: false }),
      "mcp tool call",
    );
  });
});

describe("stage transitions and report tools", () => {
  const transitions = [
    { name: "check_in_sample", run: checkInSample, status: "PENDING" },
    { name: "start_experiment", run: startExperiment, status: "EXPERIMENTING" },
    { name: "submit_experiment", run: submitExperiment, status: "FINALIZING" },
    { name: "close_ticket", run: closeTicket, status: "CLOSED" },
  ] as const;

  it.each(transitions)("$name succeeds and fails", async ({ name, run, status }) => {
    vi.mocked(run).mockResolvedValueOnce({
      success: true,
      data: { status },
    });
    const ok = parseOk(
      await session.client.callTool({ name, arguments: { contextId: "ctx-1" } }),
    );
    expect(ok).toEqual({ contextId: "ctx-1", status });
    expect(run).toHaveBeenCalledWith("ctx-1");

    vi.mocked(run).mockResolvedValueOnce({
      success: false,
      error: `${name} blocked`,
    });
    const failed = await session.client.callTool({
      name,
      arguments: { contextId: "ctx-1" },
    });
    expect(failed.isError).toBe(true);
    expect(textOf(failed)).toBe(`${name} blocked`);
  });

  it("runs calculations", async () => {
    vi.mocked(ticketsApi.apiV1TicketsIdGet).mockResolvedValue({
      status: "FINALIZING",
    } as never);
    vi.mocked(runCalculations).mockResolvedValue({ success: true, data: null });
    const ok = parseOk(
      await session.client.callTool({
        name: "run_calculations",
        arguments: { contextId: "ctx-1" },
      }),
    );
    expect(ok).toEqual({
      contextId: "ctx-1",
      note: "Calculations finished. Use get_experiment to read the results.",
    });

    vi.mocked(runCalculations).mockResolvedValue({
      success: false,
      error: "One or more calculations didn't produce a result.",
    });
    const failed = await session.client.callTool({
      name: "run_calculations",
      arguments: { contextId: "ctx-1" },
    });
    expect(failed.isError).toBe(true);
    expect(textOf(failed)).toContain("calculations");
  });

  it("queues a report", async () => {
    vi.mocked(ticketsApi.apiV1TicketsIdGet).mockResolvedValue({
      status: "FINALIZING",
    } as never);
    vi.mocked(queueReport).mockResolvedValue({
      success: true,
      data: { status: "pending" },
    });
    const ok = parseOk(
      await session.client.callTool({
        name: "generate_report",
        arguments: { contextId: "ctx-1" },
      }),
    );
    expect(ok).toEqual({ contextId: "ctx-1", reportStatus: "pending" });

    vi.mocked(queueReport).mockResolvedValue({
      success: false,
      error: "Could not start report generation.",
    });
    const failed = await session.client.callTool({
      name: "generate_report",
      arguments: { contextId: "ctx-1" },
    });
    expect(failed.isError).toBe(true);
    expect(textOf(failed)).toBe("Could not start report generation.");
  });

  const gated = [
    { name: "run_calculations", run: runCalculations },
    { name: "generate_report", run: queueReport },
  ] as const;

  it.each(gated)("$name fails when the ticket cannot be loaded", async ({ name, run }) => {
    vi.mocked(ticketsApi.apiV1TicketsIdGet).mockRejectedValue(new Error("gone"));

    const result = await session.client.callTool({
      name,
      arguments: { contextId: "missing" },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("No experiment found for context id missing.");
    expect(run).not.toHaveBeenCalled();
  });

  it.each(gated)("$name is only allowed in FINALIZING", async ({ name, run }) => {
    vi.mocked(ticketsApi.apiV1TicketsIdGet).mockResolvedValue({
      status: "EXPERIMENTING",
    } as never);

    const result = await session.client.callTool({
      name,
      arguments: { contextId: "ctx-1" },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      "Only allowed in the FINALIZING stage; this experiment is EXPERIMENTING.",
    );
    expect(run).not.toHaveBeenCalled();
  });

  it.each(gated)("$name treats a missing ticket status as unknown", async ({ name, run }) => {
    vi.mocked(ticketsApi.apiV1TicketsIdGet).mockResolvedValue({} as never);

    const result = await session.client.callTool({
      name,
      arguments: { contextId: "ctx-1" },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      "Only allowed in the FINALIZING stage; this experiment is unknown.",
    );
    expect(run).not.toHaveBeenCalled();
  });

  it("returns a report download url", async () => {
    vi.mocked(getReportUrl).mockResolvedValue({
      success: true,
      data: { url: "https://files.test/report.pdf" },
    });
    const ok = parseOk(
      await session.client.callTool({
        name: "get_report_download_url",
        arguments: { contextId: "ctx-1" },
      }),
    );
    expect(ok).toEqual({
      contextId: "ctx-1",
      url: "https://files.test/report.pdf",
    });

    vi.mocked(getReportUrl).mockResolvedValue({
      success: false,
      error: "The report isn't ready to download yet.",
    });
    const failed = await session.client.callTool({
      name: "get_report_download_url",
      arguments: { contextId: "ctx-1" },
    });
    expect(failed.isError).toBe(true);
    expect(textOf(failed)).toBe("The report isn't ready to download yet.");
  });

  it("forwards onboarding tools to the shared helpers", async () => {
    const draft = {
      clientForm: { name: "Client", questions: [] },
      labForm: { name: "Lab", questions: [] },
      calculations: {},
    };
    vi.mocked(listOnboardingSamples).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listOnboardingTemplates).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getOnboardingTemplate).mockResolvedValue({
      success: true,
      data: {
        templateId: "t1",
        lineageId: "lin-1",
        title: "Ash",
        description: null,
        version: 1,
        hasPdfTemplate: false,
        visible: false,
        template: draft,
      },
    });
    vi.mocked(createOnboardingSample).mockResolvedValue({
      success: true,
      data: { id: "s1", name: "Coal" },
    });
    vi.mocked(testOnboardingCalculations).mockResolvedValue({
      success: true,
      data: {
        values: {},
        order: [],
        calculations: {},
        missing_values: [],
        duplicate_question_ids: [],
      },
    });
    vi.mocked(onboardTemplate).mockResolvedValue({
      success: true,
      data: {
        sampleId: "s1",
        sampleName: "Coal",
        createdSample: false,
        templateId: "t1",
        lineageId: "lin-1",
        reportLayout: true,
        published: false,
        formulaCheck: null,
      },
    });

    expect(parseOk(await session.client.callTool({ name: "list_samples", arguments: {} }))).toEqual([]);
    expect(
      parseOk(await session.client.callTool({ name: "list_templates", arguments: { sampleId: "s1" } })),
    ).toEqual([]);
    expect(
      (await session.client.callTool({
        name: "get_template",
        arguments: { sampleId: "s1", templateId: "t1" },
      })).isError,
    ).toBeFalsy();
    expect(
      parseOk(
        await session.client.callTool({
          name: "create_sample",
          arguments: { name: "Coal", description: "Raw" },
        }),
      ),
    ).toEqual({ id: "s1", name: "Coal" });
    await session.client.callTool({
      name: "test_template_calculations",
      arguments: { template: draft },
    });
    await session.client.callTool({
      name: "test_template_calculations",
      arguments: { template: draft, values: { mass: 1 } },
    });
    expect(testOnboardingCalculations).toHaveBeenLastCalledWith(draft, { mass: 1 });
    expect(
      parseOk(
        await session.client.callTool({
          name: "onboard_template",
          arguments: { title: "Ash", template: draft },
        }),
      ).templateId,
    ).toBe("t1");
    vi.mocked(onboardTemplate).mockResolvedValue({
      success: false,
      error: "Template title is required.",
    });
    const refused = await session.client.callTool({
      name: "onboard_template",
      arguments: { title: "Ash", template: draft },
    });
    expect(refused.isError).toBe(true);
    expect(textOf(refused)).toBe("Template title is required.");
  });
});

describe("audited error handling", () => {
  it("returns a generic isError message and logs when a handler throws", async () => {
    const err = new Error("custapi exploded");
    vi.mocked(listExperimentsForStaff).mockRejectedValue(err);

    const result = await session.client.callTool({
      name: "list_experiments",
      arguments: {},
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      "Something went wrong on the lab server. Try again.",
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        op: "mcp.tool",
        tool: "list_experiments",
        userId: actor.userId,
        clientId: actor.clientId,
        err,
      }),
      "mcp tool failed",
    );
    expect(logger.info).not.toHaveBeenCalled();
  });
});
