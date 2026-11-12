"use server";

import type { AnswerValue } from "@repo/forms";

import type { ActionResult } from "@/app/actions/experiment-manager";
import { getSession } from "@/lib/auth/dal";
import {
  type CalculationInputs,
  type CalculationResultsInput,
  checkInSample,
  closeTicket,
  fixExperimentFormula,
  getReportStatus,
  getCalculationInputs,
  getReportUrl,
  queueReport,
  saveCalculationResults,
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

// Calculations run in the browser (lib/calculations): fetch the inputs, then
// save what the engine produced.
export async function getCalculationInputsAction(
  contextId: string,
): Promise<ActionResult<CalculationInputs>> {
  if (!(await isAdmin())) {
    return { success: false, error: "You aren't allowed to run calculations." };
  }
  return getCalculationInputs(contextId);
}

export async function saveCalculationResultsAction(
  contextId: string,
  body: CalculationResultsInput,
): Promise<ActionResult<null>> {
  if (!(await isAdmin())) {
    return { success: false, error: "You aren't allowed to run calculations." };
  }
  return saveCalculationResults(contextId, body);
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
