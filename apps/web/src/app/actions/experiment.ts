"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/actions/experiment-manager";
import { getSession } from "@/lib/auth/dal";
import { hydrate, persistNow } from "@/lib/collab/room";
import {
  calculateExperiment,
  generateReport,
  getExperiment,
  getReportDownloadUrl,
} from "@/lib/experiment-manager/client";
import { errorMessage } from "@/lib/experiment-manager/errors";
import {
  experimentCheckinPath,
  experimentListingPath,
  experimentWorkspacePath,
} from "@/lib/experiment-manager/routes";
import { ticketsApi } from "@/lib/ticketing/client";

function reportReady(status: string | null | undefined): boolean {
  const normalized = status?.toLowerCase();
  return normalized === "success" || normalized === "succeeded";
}

function calculationsReady(exp: Awaited<ReturnType<typeof getExperiment>>): boolean {
  const calculations = exp.calculations ?? {};
  return Object.values(calculations).every((calc) => {
    if (typeof calc === "string") return false;
    return (
      calc.result !== undefined &&
      calc.result !== null &&
      calc.result !== ""
    );
  });
}

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

/**
 * Run the experiment's calculations (FINALIZING stage). Evaluates every
 * `calculations[*].formula` against the entered values and writes the results
 * back in experiment-manager. Idempotent and re-runnable; report generation
 * depends on this having run when the template defines calculations.
 */
export async function calculateExperimentAction(
  contextId: string,
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { success: false, error: "You aren't allowed to run calculations." };
  }

  try {
    await calculateExperiment(contextId);
    revalidatePath(experimentWorkspacePath(contextId));
    return { success: true, data: null };
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error, "Could not run calculations."),
    };
  }
}

/**
 * Queue PDF report generation (FINALIZING stage). Generation is asynchronous —
 * this returns the queued status; the worker renders + uploads the PDF and the
 * caller polls `getReportStatusAction` until it reaches a terminal state.
 */
export async function generateReportAction(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { success: false, error: "You aren't allowed to generate a report." };
  }

  try {
    const res = await generateReport(contextId);
    revalidatePath(experimentWorkspacePath(contextId));
    return { success: true, data: { status: res.status } };
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error, "Could not start report generation."),
    };
  }
}

/**
 * Current report-generation status for an experiment, read from its
 * experiment-manager context. Used to poll while a report is pending/processing.
 */
export async function getReportStatusAction(
  contextId: string,
): Promise<ActionResult<{ status: string | null; generatedAt: string | null }>> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { success: false, error: "You aren't allowed to view this report." };
  }

  try {
    const exp = await getExperiment(contextId);
    return {
      success: true,
      data: {
        status: exp.report_status ?? null,
        generatedAt: exp.report_generated_at ?? null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error, "Could not check the report status."),
    };
  }
}

/**
 * A short-lived presigned download URL for the generated PDF report. Only
 * resolves once generation has succeeded; surfaces a friendly error otherwise.
 */
export async function getReportDownloadUrlAction(
  contextId: string,
): Promise<ActionResult<{ url: string }>> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { success: false, error: "You aren't allowed to download this report." };
  }

  try {
    const res = await getReportDownloadUrl(contextId);
    return { success: true, data: { url: res.url } };
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error, "The report isn't ready to download yet."),
    };
  }
}

/**
 * Close a finalized ticket. The normal FINALIZING → CLOSED transition does not
 * require a close reason, but the lab must have completed calculations and
 * generated the PDF report first.
 */
export async function closeTicketAction(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { success: false, error: "You aren't allowed to close this ticket." };
  }

  let exp: Awaited<ReturnType<typeof getExperiment>>;
  try {
    exp = await getExperiment(contextId);
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error, "Could not verify this experiment is ready to close."),
    };
  }

  if (!calculationsReady(exp)) {
    return {
      success: false,
      error: "Run calculations before closing this ticket.",
    };
  }

  if (!reportReady(exp.report_status)) {
    return {
      success: false,
      error: "Generate the PDF report before closing this ticket.",
    };
  }

  try {
    const ticket = await ticketsApi.apiV1TicketsIdStatusPatch(contextId, {
      status: "CLOSED",
    });
    revalidatePath(experimentWorkspacePath(contextId));
    revalidatePath(experimentListingPath());
    return { success: true, data: { status: ticket.status ?? "CLOSED" } };
  } catch (error) {
    return {
      success: false,
      error: await errorText(error, "Could not close this ticket."),
    };
  }
}
