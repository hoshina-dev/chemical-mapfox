"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/actions/experiment-manager";
import { requireAdmin } from "@/lib/auth/dal";
import {
  getExperiment,
  upsertPdfTemplate,
} from "@/lib/experiment-manager/client";
import { errorMessage } from "@/lib/experiment-manager/errors";
import { templateBuilderPath } from "@/lib/experiment-manager/routes";
import { ticketsApi } from "@/lib/ticketing/client";
import { formatDateTime, toExperimentTicket } from "@/lib/ticketing/tickets";

/** A previewable experiment for the PDF editor's "from experiment" mode. */
export interface PdfPreviewExperiment {
  id: string;
  label: string;
}

/**
 * Persist a template's PDF layout. The backend attaches the components to the
 * lineage's current version, so the saved version id may differ from the one
 * being edited — surface it so the editor can navigate to the canonical URL.
 */
export async function savePdfTemplateAction(
  sampleId: string,
  lineageId: string,
  components: unknown[],
  currentTemplateId?: string,
): Promise<ActionResult<{ templateId: string }>> {
  await requireAdmin();
  try {
    const pdf = await upsertPdfTemplate(sampleId, lineageId, components);
    revalidatePath(`/internal/experiment/onboarding/${sampleId}`);
    if (currentTemplateId) {
      revalidatePath(
        templateBuilderPath({ sampleId, templateId: currentTemplateId }) + "/pdf",
      );
    }
    if (pdf.template_id !== currentTemplateId) {
      revalidatePath(
        templateBuilderPath({ sampleId, templateId: pdf.template_id }) + "/pdf",
      );
    }
    return { success: true, data: { templateId: pdf.template_id } };
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error, "Could not save the PDF layout."),
    };
  }
}

/**
 * Experiments (ticket contexts) created from this template lineage, for the
 * editor's live-preview dropdown. Best-effort: returns an empty list if
 * ticketing is unreachable rather than failing the editor.
 */
export async function listTemplateExperimentsAction(
  lineageId: string,
): Promise<ActionResult<PdfPreviewExperiment[]>> {
  await requireAdmin();
  try {
    const rows = await ticketsApi.apiV1TicketsGet(
      undefined,
      undefined,
      undefined,
      "updated_at",
      "desc",
    );
    const experiments = rows
      .map(toExperimentTicket)
      .filter((ticket) => ticket.templateId === lineageId && ticket.contextId)
      .map((ticket) => ({
        id: ticket.contextId,
        label: `${ticket.name ?? ticket.contextId.slice(0, 8)} · ${formatDateTime(
          ticket.updatedAt ?? ticket.createdAt,
        )}`,
      }));
    return { success: true, data: experiments };
  } catch {
    return { success: true, data: [] };
  }
}

function isScalar(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Flattened render context for previewing an experiment in the PDF editor —
 * mirrors how the report engine resolves `{{field}}` placeholders: scalar
 * `values`, then each `calculations[name]` resolved to its `result` when
 * computed (else the formula string). Lists/objects are skipped (unrenderable).
 */
export async function getExperimentPreviewContextAction(
  contextId: string,
): Promise<ActionResult<Record<string, unknown>>> {
  await requireAdmin();
  try {
    const exp = await getExperiment(contextId);
    const context: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(exp.values ?? {})) {
      if (isScalar(value)) context[key] = value;
    }

    for (const [name, calc] of Object.entries(exp.calculations ?? {})) {
      if (typeof calc === "string") {
        context[name] = calc;
        continue;
      }
      const result = calc.result;
      if (isScalar(result)) {
        context[name] = result;
      } else if (typeof calc.formula === "string") {
        context[name] = calc.formula;
      }
    }

    return { success: true, data: context };
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error, "Could not load the experiment for preview."),
    };
  }
}
