"use server";

import { getTranslations } from "next-intl/server";

import type { ActionResult } from "@/app/actions/onboarding";
import { getSession } from "@/lib/auth/dal";
import {
  checkIn,
  close,
  finish,
  type FinishInputs,
  finishInputs,
  publish,
  reopen,
  start,
} from "@/lib/staff/lifecycle";

// The lifecycle lives in lib/staff/lifecycle.ts; these actions only gate on the
// cookie session (staff) and pass the staff member as the actor.

async function staff(): Promise<string | null> {
  const session = await getSession();
  return session?.role === "admin" ? session.userId : null;
}

async function forbidden(): Promise<ActionResult<never>> {
  const t = await getTranslations("staff.lifecycle");
  return { success: false, error: t("forbidden") };
}

export async function checkInSampleAction(ticketId: string): Promise<ActionResult<null>> {
  const actor = await staff();
  return actor ? checkIn(actor, ticketId) : forbidden();
}

export async function startExperimentAction(
  ticketId: string,
  experimentId: string,
): Promise<ActionResult<null>> {
  const actor = await staff();
  return actor ? start(actor, ticketId, experimentId) : forbidden();
}

/** Step 1 of finishing (see lib/calculations/calculateExperiment.ts). */
export async function finishInputsAction(room: string): Promise<ActionResult<FinishInputs>> {
  return (await staff()) ? finishInputs(room) : forbidden();
}

/** Step 2 of finishing: the browser's results. */
export async function finishExperimentAction(
  room: string,
  version: number,
  calculationsJson: string,
): Promise<ActionResult<null>> {
  const actor = await staff();
  return actor ? finish(actor, room, version, calculationsJson) : forbidden();
}

export async function reopenExperimentAction(
  ticketId: string,
  experimentId: string,
  reason: string,
): Promise<ActionResult<null>> {
  const actor = await staff();
  return actor ? reopen(actor, ticketId, experimentId, reason) : forbidden();
}

/** Close a completed ticket; with a reason, cancel an open one. */
export async function closeTicketAction(
  ticketId: string,
  reason?: string,
): Promise<ActionResult<null>> {
  const actor = await staff();
  return actor ? close(actor, ticketId, reason) : forbidden();
}

export async function publishReportAction(ticketId: string): Promise<ActionResult<null>> {
  const actor = await staff();
  return actor ? publish(actor, ticketId) : forbidden();
}
