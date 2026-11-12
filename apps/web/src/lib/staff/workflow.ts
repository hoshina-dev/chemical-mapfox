import "server-only";

import { isDeepStrictEqual } from "node:util";

import type { AnswerValue } from "@repo/forms";
import { FormAnswers, validateAnswers } from "@repo/forms";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import type { ActionResult } from "@/app/actions/experiment-manager";
import { hydrate, persistNow } from "@/lib/collab/room";
import {
  calculateExperiment,
  generateReport,
  getExperiment,
  getExperimentJson,
  getReportDownloadUrl,
  updateExperiment,
  updateExperimentJson,
  updateExperimentCalculations,
  type ExperimentDetail,
} from "@/lib/experiment-manager/client";
import { errorMessage } from "@/lib/experiment-manager/errors";
import {
  experimentDetailToState,
  templateToExperimentUpdate,
} from "@/lib/experiment-manager/mappers";
import {
  experimentCheckinPath,
  experimentListingPath,
  experimentWorkspacePath,
} from "@/lib/experiment-manager/routes";
import { formatAnswerIssues } from "@/lib/forms/answerIssues";
import { levelForStatus, logHandledError } from "@/lib/log/handled";
import { httpStatus } from "@/lib/log/serialize";
import { ticketsApi } from "@/lib/ticketing/client";

/**
 * The staff experiment lifecycle, shared by the `/internal` server actions and
 * the MCP tools. Callers must have verified the actor is an admin: these
 * functions don't read the session, because MCP requests authenticate with a
 * bearer token instead of the cookie.
 */

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
export async function submitExperiment(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  try {
    await hydrate(contextId);
    await persistNow(contextId);
  } catch (error) {
    logHandledError(error, { action: "submitExperimentAction", op: "persist", contextId });
    return {
      success: false,
      error: await errorText(
        error,
        "Couldn't save the latest values before submitting. Try again.",
      ),
    };
  }

  try {
    const exp = await getExperiment(contextId);
    const state = experimentDetailToState(exp);
    // Last gate before the values become the experiment record: the live editor
    // only enforces the constraints a half-typed answer can't violate, so the
    // full set (required, minimums, ranges) is checked here.
    const issues = validateAnswers(state.template.labForm.questions, state.values);
    if (issues.length > 0) {
      const tIssue = await getTranslations("forms.validation");
      return {
        success: false,
        error: `${tIssue("invalidTitle")}\n${formatAnswerIssues(tIssue, issues)}`,
      };
    }
  } catch (error) {
    logHandledError(error, { action: "submitExperimentAction", op: "verifyValues", contextId });
    return {
      success: false,
      error: errorMessage(error, "Could not verify the submitted values."),
    };
  }

  try {
    const ticket = await ticketsApi.apiV1TicketsIdStatusPatch(contextId, {
      status: "FINALIZING",
    });
    revalidatePath(experimentWorkspacePath(contextId));
    return { success: true, data: { status: ticket.status ?? "FINALIZING" } };
  } catch (error) {
    logHandledError(error, { action: "submitExperimentAction", service: "ticketing", contextId });
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
export async function checkInSample(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  try {
    const ticket = await ticketsApi.apiV1TicketsIdStatusPatch(contextId, {
      status: "PENDING",
    });
    revalidatePath(experimentCheckinPath(contextId));
    revalidatePath(experimentWorkspacePath(contextId));
    return { success: true, data: { status: ticket.status ?? "PENDING" } };
  } catch (error) {
    logHandledError(error, { action: "checkInSampleAction", service: "ticketing", contextId });
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
export async function startExperiment(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  try {
    const ticket = await ticketsApi.apiV1TicketsIdStatusPatch(contextId, {
      status: "EXPERIMENTING",
    });
    revalidatePath(experimentWorkspacePath(contextId));
    return { success: true, data: { status: ticket.status ?? "EXPERIMENTING" } };
  } catch (error) {
    logHandledError(error, { action: "startExperimentAction", service: "ticketing", contextId });
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
export async function runCalculations(
  contextId: string,
): Promise<ActionResult<null>> {
  try {
    const exp = await calculateExperiment(contextId);
    revalidatePath(experimentWorkspacePath(contextId));
    if (!calculationsReady(exp)) {
      return {
        success: false,
        error:
          "One or more calculations didn't produce a result. Check the formulas and values, then try again.",
      };
    }
    return { success: true, data: null };
  } catch (error) {
    logHandledError(error, { action: "calculateExperimentAction", contextId });
    return {
      success: false,
      error: errorMessage(error, "Could not run calculations."),
    };
  }
}

type JsonObject = Record<string, unknown>;

const { rawJSON, isRawJSON } = JSON as unknown as {
  rawJSON(text: string): { rawJSON: string };
  isRawJSON(value: unknown): value is { rawJSON: string };
};

/**
 * JSON.parse that keeps each number's source text, so re-serializing is exact
 * (10.0 stays a float for Python, integers past 2^53 survive).
 */
function parseExact(text: string): unknown {
  const reviver = (_key: string, value: unknown, context?: { source?: string }) =>
    typeof value === "number" ? rawJSON(context?.source ?? String(value)) : value;
  return JSON.parse(text, reviver as (key: string, value: unknown) => unknown);
}

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !isRawJSON(value)
    ? (value as JsonObject)
    : null;
}

function parseObject(text: string): JsonObject | null {
  try {
    return asObject(parseExact(text));
  } catch {
    return null;
  }
}

/** Numbers as Python's == sees them: exact integers, 5.0 == 5, -0.0 == 0. */
function pythonEqual(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown): unknown => {
    if (isRawJSON(value)) {
      const source = value.rawJSON;
      if (!/[.eE]/.test(source)) return `#${BigInt(source)}`;
      const n = Number(source);
      return Number.isInteger(n) ? `#${BigInt(n)}` : `#${n}`;
    }
    if (Array.isArray(value)) return value.map(canonical);
    const object = asObject(value);
    return object
      ? Object.fromEntries(Object.entries(object).map(([k, v]) => [k, canonical(v)]))
      : value;
  };
  return isDeepStrictEqual(canonical(a), canonical(b));
}

function formulasOf(calculations: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(asObject(calculations) ?? {}).map(([name, calc]) => [
      name,
      typeof calc === "string" ? calc : String((calc as { formula?: unknown }).formula),
    ]),
  );
}

/** Question ids the engine fills from a default, as `collect_values` does. */
function defaultedIds(exp: JsonObject): Set<string> {
  const ids = new Set<string>();
  const visit = (question: unknown) => {
    const q = asObject(question) ?? {};
    const config = asObject(q.config) ?? {};
    if (q.type === "repeatable-group") {
      if (Array.isArray(config.questions)) config.questions.forEach(visit);
    } else if (typeof q.id === "string" && (config.default ?? q.default) != null) {
      ids.add(q.id);
    }
  };
  for (const form of [exp.clientForm, exp.labForm]) {
    const questions = asObject(form)?.questions;
    if (Array.isArray(questions)) questions.forEach(visit);
  }
  return ids;
}

/** The inputs a run depends on, compared exactly to detect changes. */
function fingerprintOf(experimentJson: string): string {
  const exp = asObject(parseExact(experimentJson)) ?? {};
  return JSON.stringify({ values: exp.values ?? {}, formulas: formulasOf(exp.calculations) });
}

/** What the browser needs to run an experiment's calculations. */
export interface CalculationInputs {
  /** The stored experiment, unparsed; the engine reads it as a dry-run body. */
  experimentJson: string;
  /** Echoed back on save, which refuses if the inputs changed in between. */
  fingerprint: string;
}

/** The engine's output for `getCalculationInputs` (see `lib/calculations`). */
export interface CalculationResultsInput {
  fingerprint: string;
  valuesJson: string;
  calculationsJson: string;
}

export async function getCalculationInputs(
  contextId: string,
): Promise<ActionResult<CalculationInputs>> {
  try {
    const experimentJson = await getExperimentJson(contextId);
    return {
      success: true,
      data: { experimentJson, fingerprint: fingerprintOf(experimentJson) },
    };
  } catch (error) {
    logHandledError(error, { action: "getCalculationInputsAction", contextId });
    const t = await getTranslations("staff.finalize");
    return { success: false, error: errorMessage(error, t("calcLoadFailed")) };
  }
}

/**
 * Store results computed in the browser from `getCalculationInputs`, with the
 * values they came from, the way `POST /calculate` does. Refuses if the inputs
 * changed meanwhile; the window between this read and the PUT is not closed
 * (experiment-manager has no versioning).
 */
export async function saveCalculationResults(
  contextId: string,
  { fingerprint, valuesJson, calculationsJson }: CalculationResultsInput,
): Promise<ActionResult<null>> {
  const t = await getTranslations("staff.finalize");
  const values = parseObject(valuesJson);
  const calculations = parseObject(calculationsJson);
  if (!values || !calculations) return { success: false, error: t("calcSaveFailed") };

  try {
    const currentJson = await getExperimentJson(contextId);
    if (fingerprintOf(currentJson) !== fingerprint) {
      return { success: false, error: t("calcInputsChanged") };
    }
    const current = asObject(parseExact(currentJson)) ?? {};
    const stored = asObject(current.values) ?? {};
    const defaults = defaultedIds(current);
    // A run only fills in question defaults; it never changes an answer.
    const onlyAddsDefaults =
      Object.entries(stored).every(([id, answer]) => pythonEqual(values[id], answer)) &&
      Object.keys(values).every((id) => id in stored || defaults.has(id));
    if (
      !onlyAddsDefaults ||
      !isDeepStrictEqual(formulasOf(calculations), formulasOf(current.calculations))
    ) {
      return { success: false, error: t("calcSaveFailed") };
    }

    const savedJson = await updateExperimentJson(
      contextId,
      `{"clientForm":${JSON.stringify(current.clientForm)},"labForm":${JSON.stringify(current.labForm)},"calculations":${calculationsJson},"values":${valuesJson}}`,
    );
    revalidatePath(experimentWorkspacePath(contextId));
    const saved = asObject(asObject(parseExact(savedJson))?.calculations) ?? {};
    // An experiment-manager that predates storing `result` on PUT keeps the old ones.
    const savedAsSent = Object.entries(calculations).every(([name, calc]) =>
      pythonEqual(asObject(saved[name])?.result, asObject(calc)?.result),
    );
    if (!savedAsSent) {
      logHandledError(new Error("calculation results were not stored"), {
        action: "saveCalculationResultsAction",
        contextId,
      });
      return { success: false, error: t("calcSaveFailed") };
    }
    const exp = JSON.parse(savedJson) as ExperimentDetail;
    if (!calculationsReady(exp)) return { success: false, error: t("calcNoResult") };
    return { success: true, data: null };
  } catch (error) {
    logHandledError(error, { action: "saveCalculationResultsAction", contextId });
    return { success: false, error: errorMessage(error, t("calcSaveFailed")) };
  }
}

/**
 * Verify `contextId` is a FINALIZING-stage ticket. Shared by the "fix values"
 * and "fix formula" paths so both stay restricted to FINALIZING — never
 * EXPERIMENTING, where the Redis-backed collaborative editor already owns
 * writes to this experiment.
 */
async function requireFinalizingTicket(
  contextId: string,
): Promise<{ error: string } | null> {
  try {
    const ticket = await ticketsApi.apiV1TicketsIdGet(contextId);
    if (ticket.status !== "FINALIZING") {
      return {
        error: "This can only be fixed while the ticket is in the Finalizing stage.",
      };
    }
    return null;
  } catch (error) {
    logHandledError(error, { op: "requireFinalizingTicket", service: "ticketing", contextId });
    return { error: await errorText(error, "Could not verify this ticket's stage.") };
  }
}

/**
 * Fix the lab-form values of a FINALIZING-stage experiment (e.g. a bad reading
 * caused a calculation error). Writes straight to experiment-manager — no
 * ticket status change, since ticketing-service has no transition back out of
 * FINALIZING. Clears any stale calculation results (they were computed from
 * the old values) so the UI correctly asks for a fresh "Calculate" run.
 */
export async function updateFinalizingValues(
  contextId: string,
  labFormValues: Record<string, AnswerValue>,
): Promise<ActionResult<null>> {
  const gate = await requireFinalizingTicket(contextId);
  if (gate) return { success: false, error: gate.error };

  const parsedInput = FormAnswers.safeParse(labFormValues);
  if (!parsedInput.success) {
    const tIssue = await getTranslations("forms.validation");
    return { success: false, error: tIssue("invalidPayload") };
  }

  try {
    const exp = await getExperiment(contextId);
    const state = experimentDetailToState(exp);
    const issues = validateAnswers(
      state.template.labForm.questions,
      parsedInput.data,
    );
    if (issues.length > 0) {
      const tIssue = await getTranslations("forms.validation");
      return {
        success: false,
        error: `${tIssue("invalidTitle")}\n${formatAnswerIssues(tIssue, issues)}`,
      };
    }
    const values: Record<string, AnswerValue> = {
      ...(exp.values as Record<string, AnswerValue> | undefined),
      ...parsedInput.data,
    };
    await updateExperiment(
      contextId,
      templateToExperimentUpdate(state.wireSnapshot, values),
    );
    revalidatePath(experimentWorkspacePath(contextId));
    return { success: true, data: null };
  } catch (error) {
    logHandledError(error, { action: "updateExperimentValuesAction", contextId });
    return {
      success: false,
      error: errorMessage(error, "Could not save the fixed values."),
    };
  }
}

/**
 * Fix a FINALIZING-stage experiment's own calculation formula (e.g. a formula
 * bug like an unguarded division). Scoped to this one experiment via
 * `PUT /api/experiments/{exp_id}/calculations` — doesn't touch template_id,
 * doesn't fork a new template version, doesn't affect any other experiment on
 * the same lineage. The endpoint resets the formula's result server-side, so
 * (unlike updateFinalizingValues) there's no need to strip it here.
 */
export async function fixExperimentFormula(
  contextId: string,
  calculations: Record<string, { formula: string }>,
): Promise<ActionResult<null>> {
  const gate = await requireFinalizingTicket(contextId);
  if (gate) return { success: false, error: gate.error };

  try {
    await updateExperimentCalculations(contextId, calculations);
    revalidatePath(experimentWorkspacePath(contextId));
    return { success: true, data: null };
  } catch (error) {
    logHandledError(error, { action: "fixExperimentFormulaAction", contextId });
    return {
      success: false,
      error: errorMessage(error, "Could not save the fixed formula."),
    };
  }
}

/**
 * Queue PDF report generation (FINALIZING stage). Generation is asynchronous —
 * this returns the queued status; the worker renders + uploads the PDF and the
 * caller polls `getReportStatus` until it reaches a terminal state.
 */
export async function queueReport(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  try {
    const res = await generateReport(contextId);
    revalidatePath(experimentWorkspacePath(contextId));
    return { success: true, data: { status: res.status } };
  } catch (error) {
    logHandledError(error, { action: "generateReportAction", contextId });
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
export async function getReportStatus(
  contextId: string,
): Promise<ActionResult<{ status: string | null; generatedAt: string | null }>> {
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
    logHandledError(error, { action: "getReportStatusAction", contextId });
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
export async function getReportUrl(
  contextId: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    const res = await getReportDownloadUrl(contextId);
    return { success: true, data: { url: res.url } };
  } catch (error) {
    // Only a real 404 ("report not generated yet") is expected here; a 5xx or
    // network failure is a genuine EM outage and must not be logged as info.
    const status = httpStatus(error);
    logHandledError(error, {
      action: "getReportDownloadUrlAction",
      contextId,
      expected: status === 404,
      level: status === 404 ? "info" : levelForStatus(status),
    });
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
export async function closeTicket(
  contextId: string,
): Promise<ActionResult<{ status: string }>> {
  let exp: Awaited<ReturnType<typeof getExperiment>>;
  try {
    exp = await getExperiment(contextId);
  } catch (error) {
    logHandledError(error, { action: "closeTicketAction", op: "loadExperiment", contextId });
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
    logHandledError(error, { action: "closeTicketAction", service: "ticketing", contextId });
    return {
      success: false,
      error: await errorText(error, "Could not close this ticket."),
    };
  }
}
