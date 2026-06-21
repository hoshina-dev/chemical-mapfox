"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/actions/experiment-manager";
import { getSession } from "@/lib/auth/dal";
import { hydrate, persistNow } from "@/lib/collab/room";
import {
  experimentCheckinPath,
  experimentWorkspacePath,
} from "@/lib/experiment-manager/routes";
import { ticketsApi } from "@/lib/ticketing/client";

async function errorText(error: unknown, fallback: string): Promise<string> {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response instanceof Response
  ) {
    try {
      const body = (await error.response.clone().json()) as {
        error?: string;
        message?: string;
        detail?: string;
      };
      const message = body.error ?? body.message ?? body.detail;
      if (message) return `${fallback}\n${message}`;
    } catch {
      // fall through
    }
  }
  if (error instanceof Error && error.message) {
    return `${fallback}\n${error.message}`;
  }
  return fallback;
}

/**
 * Submit a lab experiment to the final stage. Flushes the live value buffer to
 * experiment-manager, then transitions the ticket EXPERIMENTING → FINALIZING
 * (the calc/PDF stage). The transition is only valid from EXPERIMENTING; the
 * ticketing backend rejects others with a 422 we surface as a friendly error.
 */
export async function submitExperimentAction(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { success: false, error: "You aren't allowed to submit this experiment." };
  }

  try {
    await hydrate(contextId);
    await persistNow(contextId);
  } catch (error) {
    return {
      success: false,
      error: await errorText(
        error,
        "Couldn't save the latest values before submitting. Try again.",
      ),
    };
  }

  try {
    const ticket = await ticketsApi.apiV1TicketsIdStatusPatch(contextId, {
      status: "FINALIZING",
    });
    revalidatePath(experimentWorkspacePath(contextId));
    return { success: true, data: { status: ticket.status ?? "FINALIZING" } };
  } catch (error) {
    return {
      success: false,
      error: await errorText(error, "Could not submit to the final stage."),
    };
  }
}

/**
 * Check in a shipped sample. Transitions the ticket REQUESTED → PENDING
 * ("Sample received") — the step that confirms the physical sample has arrived
 * at the lab, after which an experiment can be started. The transition is only
 * valid from REQUESTED; the ticketing backend rejects others with a 422.
 */
export async function checkInSampleAction(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { success: false, error: "You aren't allowed to check in this sample." };
  }

  try {
    const ticket = await ticketsApi.apiV1TicketsIdStatusPatch(contextId, {
      status: "PENDING",
    });
    revalidatePath(experimentCheckinPath(contextId));
    revalidatePath(experimentWorkspacePath(contextId));
    return { success: true, data: { status: ticket.status ?? "PENDING" } };
  } catch (error) {
    return {
      success: false,
      error: await errorText(error, "Could not check in this sample."),
    };
  }
}

/**
 * Start the experiment. Transitions the ticket PENDING → EXPERIMENTING, which
 * unlocks the collaborative lab-form editor in the workspace. Only valid from
 * PENDING ("Sample received"); the ticketing backend rejects others with a 422.
 */
export async function startExperimentAction(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return {
      success: false,
      error: "You aren't allowed to start this experiment.",
    };
  }

  try {
    const ticket = await ticketsApi.apiV1TicketsIdStatusPatch(contextId, {
      status: "EXPERIMENTING",
    });
    revalidatePath(experimentWorkspacePath(contextId));
    return { success: true, data: { status: ticket.status ?? "EXPERIMENTING" } };
  } catch (error) {
    return {
      success: false,
      error: await errorText(error, "Could not start this experiment."),
    };
  }
}
