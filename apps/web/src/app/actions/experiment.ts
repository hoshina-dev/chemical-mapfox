"use server";

import type { AnswerValue } from "@repo/forms";

import type { ActionResult } from "@/app/actions/experiment-manager";
import { getSession } from "@/lib/auth/dal";
import {
  checkInSample,
  closeTicket,
  fixExperimentFormula,
  getReportStatus,
  getReportUrl,
  queueReport,
  runCalculations,
  startExperiment,
  submitExperiment,
  updateFinalizingValues,
} from "@/lib/staff/workflow";

// The lifecycle itself lives in lib/staff/workflow.ts (shared with the MCP
// tools); these actions only gate on the cookie session.

async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  return session?.role === "admin";
}

export async function submitExperimentAction(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  if (!(await isAdmin())) {
    return { success: false, error: "You aren't allowed to submit this experiment." };
  }
  return submitExperiment(contextId);
}

export async function checkInSampleAction(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  if (!(await isAdmin())) {
    return { success: false, error: "You aren't allowed to check in this sample." };
  }
  return checkInSample(contextId);
}

export async function startExperimentAction(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  if (!(await isAdmin())) {
    return {
      success: false,
      error: "You aren't allowed to start this experiment.",
    };
  }
  return startExperiment(contextId);
}

export async function calculateExperimentAction(
  contextId: string,
): Promise<ActionResult<null>> {
  if (!(await isAdmin())) {
    return { success: false, error: "You aren't allowed to run calculations." };
  }
  return runCalculations(contextId);
}

export async function updateExperimentValuesAction(
  contextId: string,
  labFormValues: Record<string, AnswerValue>,
): Promise<ActionResult<null>> {
  if (!(await isAdmin())) {
    return { success: false, error: "You aren't allowed to edit this experiment." };
  }
  return updateFinalizingValues(contextId, labFormValues);
}

export async function fixExperimentFormulaAction(
  contextId: string,
  calculations: Record<string, { formula: string }>,
): Promise<ActionResult<null>> {
  if (!(await isAdmin())) {
    return { success: false, error: "You aren't allowed to edit this experiment." };
  }
  return fixExperimentFormula(contextId, calculations);
}

export async function generateReportAction(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  if (!(await isAdmin())) {
    return { success: false, error: "You aren't allowed to generate a report." };
  }
  return queueReport(contextId);
}

export async function getReportStatusAction(
  contextId: string,
): Promise<ActionResult<{ status: string | null; generatedAt: string | null }>> {
  if (!(await isAdmin())) {
    return { success: false, error: "You aren't allowed to view this report." };
  }
  return getReportStatus(contextId);
}

export async function getReportDownloadUrlAction(
  contextId: string,
): Promise<ActionResult<{ url: string }>> {
  if (!(await isAdmin())) {
    return { success: false, error: "You aren't allowed to download this report." };
  }
  return getReportUrl(contextId);
}

export async function closeTicketAction(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  if (!(await isAdmin())) {
    return { success: false, error: "You aren't allowed to close this ticket." };
  }
  return closeTicket(contextId);
}
