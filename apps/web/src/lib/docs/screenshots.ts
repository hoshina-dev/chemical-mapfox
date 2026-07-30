/**
 * Screenshot inventory for in-app documentation.
 *
 * Localized shots live at `public/docs/{locale}/{id}.webp` (capture the UI in
 * that language). Shared shots (no UI chrome / language-neutral) live at
 * `public/docs/shared/{id}.webp`.
 */

export type DocsScreenshotId =
  | "client-my-experiments-board"
  | "client-request-catalog"
  | "client-request-intake"
  | "client-experiment-detail"
  | "client-report-panel"
  | "client-sample-label"
  | "client-notification-settings"
  | "staff-experiments-listing"
  | "staff-sample-checkin"
  | "staff-workspace-start"
  | "staff-lab-form-collab"
  | "staff-workspace-tabs"
  | "staff-finalize-panel"
  | "staff-onboarding-samples"
  | "staff-register-sample"
  | "staff-sample-templates"
  | "staff-new-template"
  | "staff-template-builder"
  | "staff-builder-calculations"
  | "staff-pdf-editor"
  | "staff-component-reference";

export type DocsScreenshotMeta = {
  id: DocsScreenshotId;
  /**
   * When true, use `docs/{locale}/{id}.webp` (and fall back to `en` if the
   * current locale file is missing). When false, use `docs/shared/{id}.webp`.
   */
  localized: boolean;
  /** Short note for the SCREENSHOTS.md inventory (what to capture). */
  capture: string;
};

export const DOCS_SCREENSHOTS: Record<DocsScreenshotId, DocsScreenshotMeta> = {
  "client-my-experiments-board": {
    id: "client-my-experiments-board",
    localized: true,
    capture:
      "Client My experiments board with lifecycle lanes and at least one card.",
  },
  "client-request-catalog": {
    id: "client-request-catalog",
    localized: true,
    capture: "Request experiment catalogue with specimen groups expanded.",
  },
  "client-request-intake": {
    id: "client-request-intake",
    localized: true,
    capture: "Client intake form for a template before submit.",
  },
  "client-experiment-detail": {
    id: "client-experiment-detail",
    localized: true,
    capture:
      "Requester experiment detail with lifecycle timeline and status badge.",
  },
  "client-report-panel": {
    id: "client-report-panel",
    localized: true,
    capture: "Report panel showing View report / Download PDF actions.",
  },
  "client-sample-label": {
    id: "client-sample-label",
    localized: true,
    capture:
      "Ship your sample block with QR label and Print label on a REQUESTED detail page.",
  },
  "client-notification-settings": {
    id: "client-notification-settings",
    localized: true,
    capture: "Client Settings → email notification toggles.",
  },
  "staff-experiments-listing": {
    id: "staff-experiments-listing",
    localized: true,
    capture:
      "Staff Experiments table with search, lifecycle filters, and several rows.",
  },
  "staff-sample-checkin": {
    id: "staff-sample-checkin",
    localized: true,
    capture: "Sample check-in page with Check in sample button visible.",
  },
  "staff-workspace-start": {
    id: "staff-workspace-start",
    localized: true,
    capture:
      "Workspace in Sample received with Start experiment call-to-action.",
  },
  "staff-lab-form-collab": {
    id: "staff-lab-form-collab",
    localized: true,
    capture:
      "Lab form during In progress with presence avatars and a soft-locked field if possible.",
  },
  "staff-workspace-tabs": {
    id: "staff-workspace-tabs",
    localized: true,
    capture: "Workspace tabs Lab form / Client intake / Calculations.",
  },
  "staff-finalize-panel": {
    id: "staff-finalize-panel",
    localized: true,
    capture:
      "Finalize panel with Calculate / Generate report / Close ticket actions.",
  },
  "staff-onboarding-samples": {
    id: "staff-onboarding-samples",
    localized: true,
    capture: "Onboarding samples list with Register sample.",
  },
  "staff-register-sample": {
    id: "staff-register-sample",
    localized: true,
    capture: "Register sample modal with name and description fields.",
  },
  "staff-sample-templates": {
    id: "staff-sample-templates",
    localized: true,
    capture: "Templates table for one sample (e.g. Coal).",
  },
  "staff-new-template": {
    id: "staff-new-template",
    localized: true,
    capture: "New template builder with empty client/lab form sections.",
  },
  "staff-template-builder": {
    id: "staff-template-builder",
    localized: true,
    capture:
      "Template builder for a real example (Total Moisture Determination).",
  },
  "staff-builder-calculations": {
    id: "staff-builder-calculations",
    localized: true,
    capture: "Calculations section in the template builder with formulas.",
  },
  "staff-pdf-editor": {
    id: "staff-pdf-editor",
    localized: true,
    capture: "PDF report layout editor canvas with variables and components.",
  },
  "staff-component-reference": {
    id: "staff-component-reference",
    localized: true,
    capture:
      "Component reference index or a type page with live preview + schema fields.",
  },
};

/**
 * Which screenshot to show after each guide section.
 * Keyed by DocsGuide / DocsHub message namespace, then section key.
 */
export const GUIDE_SECTION_FIGURES: Record<
  string,
  Partial<Record<string, DocsScreenshotId>>
> = {
  "docs.client.overview": {
    lifecycle: "client-my-experiments-board",
  },
  "docs.client.request": {
    catalog: "client-request-catalog",
    intake: "client-request-intake",
  },
  "docs.client.track": {
    board: "client-my-experiments-board",
    detail: "client-experiment-detail",
    report: "client-report-panel",
  },
  "docs.client.shipping": {
    label: "client-sample-label",
  },
  "docs.client.settings": {
    where: "client-notification-settings",
  },
  "docs.staff.overview": {
    lifecycle: "staff-experiments-listing",
  },
  "docs.staff.experiments": {
    find: "staff-experiments-listing",
    open: "staff-workspace-start",
  },
  "docs.staff.checkIn": {
    how: "staff-sample-checkin",
  },
  "docs.staff.workspace": {
    stages: "staff-workspace-start",
    collab: "staff-lab-form-collab",
    tabs: "staff-workspace-tabs",
  },
  "docs.staff.finalize": {
    flow: "staff-finalize-panel",
  },
  "docs.staff.onboarding": {
    samples: "staff-onboarding-samples",
    register: "staff-register-sample",
    templates: "staff-sample-templates",
  },
  "docs.staff.templates": {
    create: "staff-new-template",
    forms: "staff-template-builder",
    calculations: "staff-builder-calculations",
  },
  "docs.staff.pdfReport": {
    open: "staff-pdf-editor",
  },
};

/** Filename as stored on disk (always `.webp`). */
export function screenshotFilename(id: DocsScreenshotId): string {
  return `${id}.webp`;
}

/**
 * Public URL path (leading slash) for a screenshot in a given locale.
 * Localized ids use the locale folder; shared ids ignore locale.
 */
export function screenshotPublicPath(
  id: DocsScreenshotId,
  locale: string,
): string {
  const meta = DOCS_SCREENSHOTS[id];
  const file = screenshotFilename(id);
  if (meta.localized) {
    return `/docs/${locale}/${file}`;
  }
  return `/docs/shared/${file}`;
}

/** Repo-relative path under apps/web for authors dropping files in. */
export function screenshotRepoPath(
  id: DocsScreenshotId,
  locale: string,
): string {
  const meta = DOCS_SCREENSHOTS[id];
  const file = screenshotFilename(id);
  if (meta.localized) {
    return `apps/web/public/docs/${locale}/${file}`;
  }
  return `apps/web/public/docs/shared/${file}`;
}
