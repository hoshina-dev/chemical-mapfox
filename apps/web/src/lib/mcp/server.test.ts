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
vi.mock("@/lib/sample-tracker/client", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/sample-tracker/client")>()),
  getTicket: vi.fn(),
  getTemplate: vi.fn(),
  listSampleTypes: vi.fn(),
  listTemplates: vi.fn(),
  createSampleType: vi.fn(),
}));
vi.mock("@/lib/staff/labValues", () => ({ recordLabValues: vi.fn() }));
vi.mock("@/lib/staff/lifecycle", () => ({
  checkIn: vi.fn(),
  start: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@/lib/staff/onboarding", () => ({
  onboardTemplate: vi.fn(),
  setCatalogueVisibility: vi.fn(),
  refreshOnboarding: vi.fn(),
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
import {
  getTemplate,
  getTicket,
  SampleTrackerError,
  type Ticket,
} from "@/lib/sample-tracker/client";
import { recordLabValues } from "@/lib/staff/labValues";
import { checkIn, close, start } from "@/lib/staff/lifecycle";
import {
  onboardTemplate,
  setCatalogueVisibility,
} from "@/lib/staff/onboarding";

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

const READ_TOOLS = [
  "list_experiments",
  "get_experiment",
  "get_report_download_url",
  "list_samples",
  "list_templates",
  "get_template",
  "list_docs",
  "read_doc",
];
const EXPERIMENT_WRITE_TOOLS = [
  "record_lab_values",
  "check_in_sample",
  "start_experiment",
  "close_ticket",
];
const TEMPLATE_WRITE_TOOLS = [
  "create_sample",
  "onboard_template",
  "set_catalogue_visibility",
];

function ticket(
  status: string,
  overrides: Partial<ExperimentTicket> = {},
): ExperimentTicket {
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
  {
    id: "ph",
    type: "number" as const,
    label: "pH",
    config: { min: 0, max: 14 },
  },
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

function experiment(
  id: string,
  status: string,
  overrides: Partial<ExperimentState> = {},
) {
  return {
    id,
    name: `Method ${id}`,
    status,
    contextVersion: 1,
    startedAt: null,
    finishedAt: null,
    state: state(overrides),
  } as ExperimentWorkspace["experiments"][number];
}

function workspace(
  overrides: Partial<ExperimentWorkspace> = {},
): ExperimentWorkspace {
  const selected =
    overrides.selected === undefined
      ? experiment("exp-1", "IN_PROGRESS")
      : overrides.selected;
  return {
    contextId: "ctx-1",
    ticket: ticket("IN_PROGRESS"),
    requester: {
      id: "u2",
      name: "Bob",
      email: "bob@lab.test",
      avatarUrl: null,
    },
    sampleType: "Water",
    experimentTitle: "Water pH",
    raw: { reportPublishedAt: null } as Ticket,
    experiments: selected ? [selected, experiment("exp-2", "PENDING")] : [],
    selected,
    state: selected?.state ?? null,
    errors: {},
    ...overrides,
  };
}

type Connected = { client: Client; close: () => Promise<void> };

async function connect(who: McpActor = actor): Promise<Connected> {
  const server = createStaffMcpServer(who, "https://lab.test");
  const client = new Client({ name: "vitest", version: "0.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

type ToolResult = {
  content: { type: string; text?: string }[];
  isError?: boolean;
};

function textOf(result: ToolResult) {
  const block = result.content[0];
  expect(block?.type).toBe("text");
  return block?.text ?? "";
}

function parseOk(result: ToolResult) {
  expect(result.isError ?? false).toBe(false);
  return JSON.parse(textOf(result)) as Record<string, unknown>;
}

const call = (name: string, args: Record<string, unknown>) =>
  session.client.callTool({ name, arguments: args }) as Promise<ToolResult>;

let session: Connected;

beforeEach(async () => {
  vi.clearAllMocks();
  session = await connect();
});

afterEach(async () => {
  await session.close();
});

describe("createStaffMcpServer", () => {
  it("registers write tools only for the granted scopes", async () => {
    const names = async (scope: string) => {
      const connected = await connect({ ...actor, scope });
      const listed = await connected.client.listTools();
      await connected.close();
      return listed.tools.map((t) => t.name).sort();
    };
    expect(await names("experiments:read")).toEqual([...READ_TOOLS].sort());
    expect(await names("experiments:read experiments:write")).toEqual(
      [...READ_TOOLS, ...EXPERIMENT_WRITE_TOOLS].sort(),
    );
    expect(await names("experiments:read templates:write")).toEqual(
      [...READ_TOOLS, ...TEMPLATE_WRITE_TOOLS].sort(),
    );
    expect(await names("staff")).toEqual(
      [
        ...READ_TOOLS,
        ...EXPERIMENT_WRITE_TOOLS,
        ...TEMPLATE_WRITE_TOOLS,
      ].sort(),
    );
  });

  it("offers no tool that runs calculations or publishes the report", async () => {
    const listed = await session.client.listTools();
    const names = listed.tools.map((t) => t.name);
    for (const banned of [
      "finish_experiment",
      "test_template_calculations",
      "publish_report",
    ]) {
      expect(names).not.toContain(banned);
    }
  });

  it("rejects a bad status enum as an input-validation error", async () => {
    const result = await call("list_experiments", { status: "NOPE" });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(
      /Invalid arguments for tool list_experiments/,
    );
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
      await call("list_experiments", { status: "RECEIVED" }),
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
      await call("list_experiments", { query: "  alice  " }),
    );
    expect(
      (byName.experiments as { contextId: string }[]).map((e) => e.contextId),
    ).toEqual(["ctx-air"]);

    const byEmail = parseOk(
      await call("list_experiments", { query: "BOB@LAB.TEST" }),
    );
    expect(
      (byEmail.experiments as { contextId: string }[]).map((e) => e.contextId),
    ).toEqual(["ctx-water"]);

    const byId = parseOk(await call("list_experiments", { query: "ctx-soil" }));
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

    const defaults = parseOk(await call("list_experiments", {}));
    expect(defaults.total).toBe(30);
    expect(defaults.requesterInfoMissing).toBeUndefined();
    expect(defaults.experiments).toHaveLength(25);

    const limited = parseOk(await call("list_experiments", { limit: 2 }));
    expect(limited.total).toBe(30);
    expect(limited.experiments).toHaveLength(2);
  });
});

describe("get_experiment", () => {
  it("fails for an unknown ticket and audits the miss", async () => {
    vi.mocked(getExperimentWorkspace).mockResolvedValue(
      workspace({ ticket: null, selected: null }),
    );

    const result = await call("get_experiment", { contextId: "missing" });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("No ticket found with id missing.");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "get_experiment",
        contextId: "missing",
        ok: false,
      }),
      "mcp tool call",
    );
  });

  it("fails when the asked experiment is not on the ticket", async () => {
    // The workspace falls back to another experiment for an unknown id.
    vi.mocked(getExperimentWorkspace).mockResolvedValue(workspace());

    const result = await call("get_experiment", {
      contextId: "ctx-1",
      experimentId: "exp-9",
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("Experiment exp-9 is not on ticket ctx-1.");
    expect(getExperimentWorkspace).toHaveBeenCalledWith("ctx-1", "exp-9");
  });

  it("lists every experiment and the next step, and overlays the live room of an IN_PROGRESS one", async () => {
    vi.mocked(getExperimentWorkspace).mockResolvedValue(workspace());
    vi.mocked(readTemplate).mockResolvedValue({
      labForm: { questions: [] },
    } as never);
    vi.mocked(readValues).mockResolvedValue({ ph: 8.1 });

    const body = parseOk(await call("get_experiment", { contextId: "ctx-1" }));
    expect(body).toMatchObject({
      contextId: "ctx-1",
      status: "IN_PROGRESS",
      statusLabel: "In progress",
      nextStep: expect.stringContaining("record_lab_values"),
      requester: { name: "Bob", email: "bob@lab.test" },
      reportPublishedAt: null,
      experiments: [
        { id: "exp-1", method: "Method exp-1", status: "IN_PROGRESS" },
        { id: "exp-2", method: "Method exp-2", status: "PENDING" },
      ],
    });
    expect(body.experiment).toMatchObject({
      id: "exp-1",
      labForm: { values: { ph: 8.1 } },
      clientIntake: { answers: { sample_id: "W-1" } },
    });
    expect(readValues).toHaveBeenCalledWith("ctx-1_exp-1");
  });

  it("keeps the stored values when the room is not hydrated or the method is not in progress", async () => {
    vi.mocked(getExperimentWorkspace).mockResolvedValue(workspace());
    vi.mocked(readTemplate).mockResolvedValue(null);
    const cold = parseOk(await call("get_experiment", { contextId: "ctx-1" }));
    expect(cold.experiment).toMatchObject({ labForm: { values: { ph: 7 } } });
    expect(readValues).not.toHaveBeenCalled();

    vi.mocked(getExperimentWorkspace).mockResolvedValue(
      workspace({
        ticket: ticket("COMPLETED"),
        selected: experiment("exp-1", "FINISHED"),
      }),
    );
    vi.mocked(readTemplate).mockClear();
    const done = parseOk(await call("get_experiment", { contextId: "ctx-1" }));
    expect(done.nextStep).toMatch(/publish the report in the browser/);
    expect(readTemplate).not.toHaveBeenCalled();
  });

  it("keeps client answers out of labForm.values and lab answers (including repeatable children) out of clientIntake", async () => {
    const labFormQuestions = [
      {
        id: "ph",
        type: "number" as const,
        label: "pH",
        config: { min: 0, max: 14 },
      },
      {
        id: "replicates",
        type: "repeatable-group" as const,
        label: "Replicates",
        config: {
          count: 2,
          questions: [
            { id: "reading", type: "number" as const, label: "Reading" },
          ],
        },
      },
    ];
    vi.mocked(getExperimentWorkspace).mockResolvedValue(
      workspace({
        ticket: ticket("COMPLETED"),
        selected: experiment("exp-1", "FINISHED", {
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

    const body = parseOk(await call("get_experiment", { contextId: "ctx-1" }));
    expect(body.experiment).toMatchObject({
      clientIntake: {
        questions: clientQuestions,
        answers: { sample_id: "W-1" },
      },
      labForm: {
        questions: labFormQuestions,
        values: { ph: 7, reading: [1.1, 1.2] },
      },
    });
  });
});

describe("experiment write tools", () => {
  it("records values as the staff member, through this grant's connection", async () => {
    vi.mocked(recordLabValues).mockResolvedValue({
      success: true,
      data: { saved: ["ph"] },
    });

    const body = parseOk(
      await call("record_lab_values", {
        contextId: "ctx-1",
        experimentId: "exp-1",
        values: { ph: 8 },
      }),
    );
    expect(body.saved).toEqual(["ph"]);
    expect(recordLabValues).toHaveBeenCalledWith(
      { userId: "staff-ada", connectionId: "mcp:grant-1" },
      "ctx-1",
      "exp-1",
      { ph: 8 },
    );
  });

  it("refuses an empty value set and passes a refusal through as an error", async () => {
    const empty = await call("record_lab_values", {
      contextId: "ctx-1",
      experimentId: "exp-1",
      values: {},
    });
    expect(empty.isError).toBe(true);
    expect(recordLabValues).not.toHaveBeenCalled();

    vi.mocked(recordLabValues).mockResolvedValue({
      success: false,
      error: "Nothing was saved.\nph: busy",
    });
    const refused = await call("record_lab_values", {
      contextId: "ctx-1",
      experimentId: "exp-1",
      values: { ph: 8 },
    });
    expect(refused.isError).toBe(true);
    expect(textOf(refused)).toBe("Nothing was saved.\nph: busy");
  });

  it("runs each lifecycle step as the staff member and reports the ticket's new status", async () => {
    vi.mocked(checkIn).mockResolvedValue({ success: true, data: null });
    vi.mocked(start).mockResolvedValue({ success: true, data: null });
    vi.mocked(close).mockResolvedValue({ success: true, data: null });
    vi.mocked(getTicket).mockResolvedValue({ status: "RECEIVED" } as Ticket);

    expect(
      parseOk(await call("check_in_sample", { contextId: "ctx-1" })),
    ).toEqual({
      contextId: "ctx-1",
      status: "RECEIVED",
    });
    expect(checkIn).toHaveBeenCalledWith("staff-ada", "ctx-1");

    await call("start_experiment", {
      contextId: "ctx-1",
      experimentId: "exp-2",
    });
    expect(start).toHaveBeenCalledWith("staff-ada", "ctx-1", "exp-2");

    await call("close_ticket", { contextId: "ctx-1" });
    expect(close).toHaveBeenCalledWith("staff-ada", "ctx-1");
  });

  it("returns sample_tracker's refusal of a step as an error", async () => {
    vi.mocked(close).mockResolvedValue({
      success: false,
      error: "Could not close.\nticket is not completed",
    });

    const result = await call("close_ticket", { contextId: "ctx-1" });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("ticket is not completed");
    expect(getTicket).not.toHaveBeenCalled();
  });
});

describe("get_report_download_url", () => {
  it("links the report only once it is published", async () => {
    vi.mocked(getTicket).mockResolvedValue({
      reportPublishedAt: null,
    } as Ticket);
    const unpublished = await call("get_report_download_url", {
      contextId: "ctx-1",
    });
    expect(unpublished.isError).toBe(true);

    vi.mocked(getTicket).mockResolvedValue({
      reportPublishedAt: "2026-01-03T00:00:00Z",
    } as Ticket);
    expect(
      parseOk(await call("get_report_download_url", { contextId: "ctx-1" })),
    ).toEqual({
      contextId: "ctx-1",
      url: "https://lab.test/internal/experiment/ctx-1/report?download=1",
    });
  });
});

describe("template tools", () => {
  it("returns a template's forms and formulas without stored results", async () => {
    vi.mocked(getTemplate).mockResolvedValue({
      id: "t1",
      sampleTypeId: "s1",
      name: "pH",
      description: null,
      isVisibleOnWeb: false,
      displayOrder: 1,
      createdAt: "",
      updatedAt: "",
      template: {
        clientForm: { name: "Client", questions: clientQuestions },
        labForm: { name: "Lab", questions: labQuestions },
        calculations: { mean_ph: { formula: "values['ph']", result: 7 } },
      },
    });

    const body = parseOk(await call("get_template", { templateId: "t1" }));
    expect(body).toMatchObject({
      templateId: "t1",
      sampleId: "s1",
      title: "pH",
      visible: false,
    });
    expect((body.template as { calculations: unknown }).calculations).toEqual({
      mean_ph: { formula: "values['ph']" },
    });
  });

  it("onboards and toggles visibility as the staff member", async () => {
    vi.mocked(onboardTemplate).mockResolvedValue({
      success: true,
      data: {
        sampleId: "s1",
        sampleName: "Water",
        createdSample: true,
        templateId: "t9",
        published: false,
      },
    });
    vi.mocked(setCatalogueVisibility).mockResolvedValue({
      success: true,
      data: null,
    });
    const template = {
      clientForm: { name: "Client", questions: [] },
      labForm: { name: "Lab", questions: labQuestions },
      calculations: {},
    };

    const onboarded = parseOk(
      await call("onboard_template", {
        sampleName: "Water",
        title: "pH",
        template,
      }),
    );
    expect(onboarded.templateId).toBe("t9");
    expect(onboardTemplate).toHaveBeenCalledWith(
      "staff-ada",
      expect.objectContaining({ sampleName: "Water", title: "pH" }),
    );

    await call("set_catalogue_visibility", {
      sampleId: "s1",
      templateId: "t9",
      visible: true,
    });
    expect(setCatalogueVisibility).toHaveBeenCalledWith(
      "staff-ada",
      "s1",
      "t9",
      true,
    );
  });
});

describe("docs tools", () => {
  it("lists the site guides with absolute links", async () => {
    const docs = JSON.parse(textOf(await call("list_docs", {}))) as {
      id: string;
      url: string;
      audience: string;
    }[];
    expect(docs).toContainEqual(
      expect.objectContaining({
        id: "staff/onboarding",
        audience: "staff",
        url: "https://lab.test/internal/docs/onboarding",
      }),
    );
    expect(docs.map((d) => d.id)).toEqual(
      expect.arrayContaining([
        "staff/overview",
        "client/request",
        "staff/question-types",
      ]),
    );
  });

  it("reads a guide as markdown and refuses an unknown id", async () => {
    const guide = textOf(await call("read_doc", { id: "staff/check-in" }));
    expect(guide).toMatch(/^# /);
    expect(guide).toContain("Page: https://lab.test/internal/docs/check-in");

    const types = textOf(
      await call("read_doc", { id: "staff/question-types" }),
    );
    expect(types).toContain("`repeatable-group`");
    expect(types).toContain("```json");

    const missing = await call("read_doc", { id: "nope" });
    expect(missing.isError).toBe(true);
  });
});

describe("audited error handling", () => {
  it("returns a generic message and logs when a handler throws", async () => {
    const err = new Error("custapi exploded");
    vi.mocked(listExperimentsForStaff).mockRejectedValue(err);

    const result = await call("list_experiments", {});
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

  it("adds sample_tracker's own message when it sent one", async () => {
    vi.mocked(getTicket).mockRejectedValue(
      new SampleTrackerError("x", 404, "ticket not found"),
    );

    const result = await call("get_report_download_url", { contextId: "nope" });
    expect(textOf(result)).toBe(
      "Something went wrong on the lab server. Try again.\nticket not found",
    );
  });
});
