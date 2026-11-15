import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/internal/experiments", () => ({
  listExperimentsForStaff: vi.fn(),
  getExperimentWorkspace: vi.fn(),
}));
vi.mock("@/lib/collab/room", () => ({
  readTemplate: vi.fn(),
  readValues: vi.fn(),
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
import type { ExperimentState } from "@/lib/experiment/templates";
import type { ExperimentTicket } from "@/lib/experiment/tickets";
import {
  type EnrichedTicket,
  type ExperimentWorkspace,
  getExperimentWorkspace,
  listExperimentsForStaff,
} from "@/lib/internal/experiments";
import { logger } from "@/lib/log/logger";
import type { McpActor } from "@/lib/oauth/store";

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

// Only read tools are left until the MCP rework (see lib/sample-tracker/client.ts).
const TOOL_NAMES = ["list_experiments", "get_experiment", "list_docs", "read_doc"] as const;

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

function selected(status: string): ExperimentWorkspace["selected"] {
  return {
    id: "exp-1",
    name: "pH",
    status,
    contextVersion: 1,
    startedAt: null,
    finishedAt: null,
    state: state(),
  } as ExperimentWorkspace["selected"];
}

function workspace(
  overrides: Partial<ExperimentWorkspace> = {},
): ExperimentWorkspace {
  return {
    contextId: "ctx-1",
    ticket: ticket("IN_PROGRESS"),
    requester: { id: "u2", name: "Bob", email: "bob@lab.test", avatarUrl: null },
    sampleType: "Water",
    experimentTitle: "Water pH",
    state: state(),
    raw: null,
    experiments: [],
    selected: selected("IN_PROGRESS"),
    errors: {},
    ...overrides,
  };
}

type Connected = { client: Client; close: () => Promise<void> };

async function connect(who: McpActor = actor): Promise<Connected> {
  const server = createStaffMcpServer(who, "https://lab.test");
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
  vi.mocked(readTemplate).mockReset();
  vi.mocked(readValues).mockReset();
  vi.mocked(logger.info).mockReset();
  vi.mocked(logger.error).mockReset();
  session = await connect();
});

afterEach(async () => {
  await session.close();
});

describe("createStaffMcpServer", () => {
  it("lists only the read tools, all marked read-only", async () => {
    const listed = await session.client.listTools();
    expect(listed.tools.map((t) => t.name)).toEqual([...TOOL_NAMES]);
    for (const tool of listed.tools) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: true });
    }
  });

  it("rejects a bad status enum as an input-validation error", async () => {
    const result = await session.client.callTool({
      name: "list_experiments",
      arguments: { status: "NOPE" },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Invalid arguments for tool list_experiments/);
    expect(logger.info).not.toHaveBeenCalled();
  });
});

describe("list_experiments", () => {
  const tickets: EnrichedTicket[] = [
    enriched("IN_PROGRESS", {
      contextId: "ctx-water",
      experimentTitle: "Water pH",
    }),
    enriched("RECEIVED", {
      contextId: "ctx-soil",
      name: "Soil metals",
      experimentTitle: "Soil metals",
      requester: null,
    }),
    enriched("COMPLETED", {
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
        arguments: { status: "RECEIVED" },
      }),
    );
    expect(byStatus.total).toBe(1);
    expect(byStatus.requesterInfoMissing).toBe(true);
    expect(byStatus.experiments).toEqual([
      expect.objectContaining({
        contextId: "ctx-soil",
        title: "Soil metals",
        status: "RECEIVED",
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

  it("overlays the method's live collab room while it is IN_PROGRESS and hydrated", async () => {
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
      status: "IN_PROGRESS",
      statusLabel: "In progress",
      requester: { name: "Bob", email: "bob@lab.test" },
    });
    expect(body.labForm).toMatchObject({ values: { ph: 8.1 } });
    expect(body.clientIntake).toMatchObject({
      answers: { sample_id: "W-1" },
    });
    expect(body.warnings).toBeUndefined();
    expect(readValues).toHaveBeenCalledWith("ctx-1_exp-1");
  });

  it("keeps the stored values when the method's room is not hydrated", async () => {
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

  it("does not read the collab room when the method is not in progress", async () => {
    vi.mocked(getExperimentWorkspace).mockResolvedValue(
      workspace({ ticket: ticket("COMPLETED"), selected: selected("FINISHED") }),
    );

    const body = parseOk(
      await session.client.callTool({
        name: "get_experiment",
        arguments: { contextId: "ctx-1" },
      }),
    );
    expect(body.status).toBe("COMPLETED");
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
    expect(withWarnings.statusLabel).toBe("Requested");

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
    expect(ticketOnly.status).toBe("CLOSED");
    expect(ticketOnly.labForm).toBeNull();
    expect(ticketOnly.clientIntake).toBeNull();
    expect(ticketOnly.report).toBeNull();
    expect(ticketOnly.calculations).toBeUndefined();
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
        ticket: ticket("COMPLETED"),
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

describe("docs tools", () => {
  it("lists the site guides with absolute links", async () => {
    const docs = JSON.parse(
      textOf(await session.client.callTool({ name: "list_docs", arguments: {} })),
    ) as { id: string; url: string; audience: string }[];
    expect(docs).toContainEqual(
      expect.objectContaining({
        id: "staff/onboarding",
        audience: "staff",
        url: "https://lab.test/internal/docs/onboarding",
      }),
    );
    expect(docs.map((d) => d.id)).toEqual(
      expect.arrayContaining(["staff/overview", "client/request", "staff/question-types"]),
    );
  });

  it("reads a guide as markdown and refuses an unknown id", async () => {
    const guide = textOf(
      await session.client.callTool({ name: "read_doc", arguments: { id: "staff/check-in" } }),
    );
    expect(guide).toMatch(/^# /);
    expect(guide).toContain("## ");
    expect(guide).toMatch(/\n1\. /);
    expect(guide).toContain("Page: https://lab.test/internal/docs/check-in");

    const types = textOf(
      await session.client.callTool({ name: "read_doc", arguments: { id: "staff/question-types" } }),
    );
    expect(types).toContain("`repeatable-group`");
    expect(types).toContain("```json");

    const missing = await session.client.callTool({ name: "read_doc", arguments: { id: "nope" } });
    expect(missing.isError).toBe(true);
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
