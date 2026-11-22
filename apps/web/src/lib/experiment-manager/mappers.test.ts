import type { ExperimentTemplate as FormTemplate } from "@repo/forms";
import { describe, expect, it } from "vitest";

import type {
  ExperimentTemplate,
  Ticket,
  TicketExperiment,
  TicketSummary,
} from "./client";
import {
  collabRoomId,
  experimentToState,
  parseRoomId,
  templateBody,
  templateToLoaded,
  toExperimentTicket,
  toTemplateSummary,
} from "./mappers";

const body = {
  clientForm: { name: "Client", questions: [] },
  labForm: { name: "Lab", questions: [] },
  calculations: { ash: { formula: "values['x']" } },
};

function template(description: string | null): ExperimentTemplate {
  return {
    id: "tpl-1",
    sampleTypeId: "coal",
    name: "Ash",
    description,
    template: body,
    isVisibleOnWeb: true,
    displayOrder: 2,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  } as ExperimentTemplate;
}

const summary: TicketSummary = {
  id: "t-1",
  name: "Coal",
  sampleTypeId: "coal",
  requesterUserId: "u-1",
  organizationId: "o-1",
  description: null,
  status: "IN_PROGRESS",
  total: 2,
  started: 2,
  finished: 1,
  requestedAt: "2026-11-01T08:00:00Z",
  receivedAt: "2026-11-02T08:00:00Z",
  closedAt: null,
  closedReason: null,
  reportPublishedAt: null,
  updatedAt: "2026-11-03T08:00:00Z",
  methods: ["Moisture", "Ash"],
};

function experiment(startedAt: string | null, finishedAt: string | null): TicketExperiment {
  return {
    id: `e-${startedAt}-${finishedAt}`,
    experimentTemplateId: "tpl-1",
    templateName: "Ash",
    status: finishedAt ? "FINISHED" : startedAt ? "IN_PROGRESS" : "PENDING",
    startedAt,
    finishedAt,
    contextVersion: 1,
    context: { ...body, values: { x: 1 } },
    createdAt: "2026-11-01T08:00:00Z",
    updatedAt: "2026-11-01T08:00:00Z",
  };
}

describe("templates", () => {
  it("loads a template edited in place (lineage = id)", () => {
    const loaded = templateToLoaded(template("PN-ISO 1171"));
    expect(loaded).toMatchObject({ id: "tpl-1", lineageId: "tpl-1", meta: { title: "Ash", description: "PN-ISO 1171" } });
    expect(templateToLoaded(template(null)).meta.description).toBeUndefined();
  });

  it("summarises a template for the onboarding tables", () => {
    expect(toTemplateSummary(template("PN-ISO 1171"))).toEqual({
      sampleId: "coal",
      templateId: "tpl-1",
      lineageId: "tpl-1",
      title: "Ash",
      description: "PN-ISO 1171",
      isVisibleOnWeb: true,
      displayOrder: 2,
    });
    expect(toTemplateSummary(template(null)).description).toBeUndefined();
  });

  it("builds the body experiment-manager stores", () => {
    const draft = body as unknown as FormTemplate;
    expect(templateBody({ title: "Ash", description: "PN-ISO 1171" }, draft)).toMatchObject({
      name: "Ash",
      description: "PN-ISO 1171",
      template: { clientForm: body.clientForm, labForm: body.labForm },
    });
    expect(templateBody({ title: "Ash" }, draft).description).toBeNull();
  });
});

describe("experimentToState", () => {
  it("is the experiment's frozen template with its values", () => {
    const state = experimentToState({ sampleTypeId: "coal" }, experiment("2026-11-02T09:00:00Z", null));
    expect(state).toMatchObject({ sampleId: "coal", templateId: "tpl-1", values: { x: 1 } });
  });

  it("has no values before any are saved", () => {
    const e = experiment(null, null);
    e.context = body;
    expect(experimentToState({ sampleTypeId: "coal" }, e).values).toEqual({});
  });
});

describe("toExperimentTicket", () => {
  it("maps a list row: no experiments, so no start or results time", () => {
    expect(toExperimentTicket(summary)).toMatchObject({
      contextId: "t-1",
      status: "IN_PROGRESS",
      createdAt: "2026-11-01T08:00:00Z",
      sampleReceivedAt: "2026-11-02T08:00:00Z",
      experimentStartedAt: null,
      resultsSubmittedAt: null,
      methods: ["Moisture", "Ash"],
    });
  });

  it("starts with the earliest method and has results only once every method finished", () => {
    const ticket: Ticket = {
      ...summary,
      experiments: [
        experiment("2026-11-02T10:00:00Z", "2026-11-03T10:00:00Z"),
        experiment("2026-11-02T09:00:00Z", null),
        experiment(null, null),
      ],
    };
    expect(toExperimentTicket(ticket)).toMatchObject({
      experimentStartedAt: "2026-11-02T09:00:00Z",
      resultsSubmittedAt: null,
    });
    ticket.experiments = [
      experiment("2026-11-02T10:00:00Z", "2026-11-03T10:00:00Z"),
      experiment("2026-11-02T09:00:00Z", "2026-11-04T09:00:00Z"),
    ];
    expect(toExperimentTicket(ticket).resultsSubmittedAt).toBe("2026-11-04T09:00:00Z");
  });

  it("names no methods when the service sends none", () => {
    const older: Partial<TicketSummary> = { ...summary };
    delete older.methods;
    expect(toExperimentTicket(older as TicketSummary).methods).toEqual([]);
  });
});

describe("collaboration rooms", () => {
  it("round-trips a ticket and experiment id", () => {
    expect(parseRoomId(collabRoomId("t-1", "e-1"))).toEqual({ ticketId: "t-1", experimentId: "e-1" });
  });

  it.each(["t-1", "_e-1", "t-1_", "t-1_e-1_x"])("rejects %s", (room) => {
    expect(parseRoomId(room)).toBeNull();
  });
});
