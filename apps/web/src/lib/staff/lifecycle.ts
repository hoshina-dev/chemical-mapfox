import "server-only";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import type { ActionResult } from "@/app/actions/onboarding";
import { hydrate, persistNow, resetRoom } from "@/lib/collab/room";
import {
  experimentCheckinPath,
  experimentListingPath,
  experimentWorkspacePath,
} from "@/lib/internal/routes";
import { myExperimentDetailPath } from "@/lib/experiment/routes";
import { logHandledError } from "@/lib/log/handled";
import {
  closeTicket,
  finishExperiment,
  getTicketText,
  publishReport,
  receiveTicket,
  reopenExperiment,
  sampleTrackerMessage,
  startExperiment,
} from "@/lib/sample-tracker/client";
import { collabRoomId, parseRoomId } from "@/lib/sample-tracker/mappers";

// The staff ticket lifecycle on sample_tracker, used by the /internal server
// actions and the MCP tools. Callers must have checked the actor is staff.

function refresh(ticketId: string) {
  revalidatePath(experimentWorkspacePath(ticketId));
  revalidatePath(experimentCheckinPath(ticketId));
  revalidatePath(experimentListingPath());
  revalidatePath(myExperimentDetailPath(ticketId));
}

async function run(
  op: string,
  ticketId: string,
  fallbackKey: string,
  call: () => Promise<unknown>,
): Promise<ActionResult<null>> {
  try {
    await call();
    refresh(ticketId);
    return { success: true, data: null };
  } catch (error) {
    logHandledError(error, { action: op, contextId: ticketId });
    const t = await getTranslations("staff.lifecycle");
    return { success: false, error: sampleTrackerMessage(error, t(fallbackKey)) };
  }
}

/** Check a shipped sample in: REQUESTED → RECEIVED. */
export const checkIn = (actor: string, ticketId: string) =>
  run("checkIn", ticketId, "checkInFailed", () => receiveTicket(actor, ticketId));

/** Start one experiment of a received ticket. */
export const start = (actor: string, ticketId: string, experimentId: string) =>
  run("startExperiment", ticketId, "startFailed", () =>
    startExperiment(actor, ticketId, experimentId),
  );

/** Reopen a finished experiment (with a reason) so its values can be corrected. */
export async function reopen(
  actor: string,
  ticketId: string,
  experimentId: string,
  reason: string,
): Promise<ActionResult<null>> {
  const result = await run("reopenExperiment", ticketId, "reopenFailed", () =>
    reopenExperiment(actor, ticketId, experimentId, reason),
  );
  if (result.success) await resetRoom(collabRoomId(ticketId, experimentId));
  return result;
}

/** Close a COMPLETED ticket, or cancel any open one when a reason is given. */
export const close = (actor: string, ticketId: string, reason?: string) =>
  run("closeTicket", ticketId, "closeFailed", () => closeTicket(actor, ticketId, reason));

/** Publish the report: staff and the requester can download it (COMPLETED or CLOSED tickets). */
export const publish = (actor: string, ticketId: string) =>
  run("publishReport", ticketId, "publishFailed", () => publishReport(actor, ticketId));

// --- finish: calculate in the browser, then finish with the results --------------

const { rawJSON } = JSON as unknown as { rawJSON(text: string): unknown };

/** JSON.parse that keeps each number's source text, so re-serializing is exact. */
function parseExact(text: string): unknown {
  const reviver = (_key: string, value: unknown, context?: { source?: string }) =>
    typeof value === "number" ? rawJSON(context?.source ?? String(value)) : value;
  return JSON.parse(text, reviver as (key: string, value: unknown) => unknown);
}

/** What the browser needs to calculate an experiment before finishing it. */
export interface FinishInputs {
  /** The stored experiment context (forms, formulas, values), numbers as stored. */
  experimentJson: string;
  /** Sent back on finish: sample_tracker refuses if the values changed meanwhile. */
  version: number;
}

/**
 * Save what the collaborative editor still holds, then read the experiment as
 * stored. `room` is the editor's `{ticketId}_{experimentId}`.
 */
export async function finishInputs(room: string): Promise<ActionResult<FinishInputs>> {
  const t = await getTranslations("staff.lifecycle");
  const ref = parseRoomId(room);
  if (!ref) return { success: false, error: t("finishFailed") };
  try {
    await hydrate(room);
    await persistNow(room);
    const ticket = parseExact(await getTicketText(ref.ticketId)) as {
      experiments: { id: string; contextVersion: number; context: unknown }[];
    };
    const exp = ticket.experiments.find((e) => e.id === ref.experimentId);
    if (!exp) return { success: false, error: t("finishFailed") };
    return {
      success: true,
      // parseExact wraps numbers (Number() cannot read them); stringify gives the text back.
      data: {
        experimentJson: JSON.stringify(exp.context),
        version: Number(JSON.stringify(exp.contextVersion)),
      },
    };
  } catch (error) {
    logHandledError(error, { action: "finishInputs", contextId: room });
    return { success: false, error: sampleTrackerMessage(error, t("finishFailed")) };
  }
}

/**
 * Finish the experiment with the results the browser computed (`calculationsJson`
 * is the engine's calculations, results as Python wrote them). The ticket becomes
 * COMPLETED once every experiment is finished.
 */
export async function finish(
  actor: string,
  room: string,
  version: number,
  calculationsJson: string,
): Promise<ActionResult<null>> {
  const t = await getTranslations("staff.lifecycle");
  const ref = parseRoomId(room);
  let calculations: Record<string, { result?: unknown }>;
  try {
    calculations = parseExact(calculationsJson) as typeof calculations;
  } catch {
    return { success: false, error: t("finishFailed") };
  }
  if (!ref || typeof calculations !== "object" || calculations === null) {
    return { success: false, error: t("finishFailed") };
  }
  const results = Object.fromEntries(
    Object.entries(calculations).map(([key, calc]) => [key, calc?.result ?? ""]),
  );
  const result = await run("finishExperiment", ref.ticketId, "finishFailed", () =>
    finishExperiment(actor, ref.ticketId, ref.experimentId, { results, version }),
  );
  if (result.success) await resetRoom(room);
  return result;
}
