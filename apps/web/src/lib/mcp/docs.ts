import "server-only";

import { GALLERY } from "@repo/forms";
import { type AbstractIntlMessages, createTranslator } from "next-intl";

import en from "@/../messages/en.json";
import { CLIENT_DOC_GUIDES, type DocsNavItem, STAFF_DOC_GUIDES } from "@/lib/docs/nav";
import { staffComponentsPath } from "@/lib/docs/routes";

/**
 * The site's own how-to guides (the copy /internal/docs and /experiment/docs
 * render), served to MCP clients so the assistant answers from them.
 * English only: the assistant replies in the user's language anyway.
 */

type Section = { heading: string; body: string; steps?: string[] };
type Guide = { title: string; subtitle: string; sections: Record<string, Section> };

export interface DocSummary {
  id: string;
  audience: "staff" | "client";
  title: string;
  summary: string;
  path: string;
}

// Untyped messages: keys are built from the nav table at runtime.
const t = createTranslator({ locale: "en", messages: en as unknown as AbstractIntlMessages, namespace: "docs" });
const raw = en.docs as unknown as Record<"staff" | "client", Record<string, Guide>>;

const QUESTION_TYPES_ID = "staff/question-types";

function guideDocs(audience: "staff" | "client", nav: readonly DocsNavItem[]) {
  return nav.flatMap((item) => {
    const guide = raw[audience][item.key];
    if (!guide?.sections) return [];
    const slug = item.href.split("/docs")[1]?.replace(/^\//, "") || "overview";
    return [{ id: `${audience}/${slug}`, audience, key: item.key, path: item.href }];
  });
}

const GUIDES = [...guideDocs("staff", STAFF_DOC_GUIDES), ...guideDocs("client", CLIENT_DOC_GUIDES)];

export function listDocs(): DocSummary[] {
  return [
    ...GUIDES.map(({ id, audience, key, path }) => ({
      id,
      audience,
      title: t(`${audience}.${key}.title`),
      summary: t(`${audience}.${key}.subtitle`),
      path,
    })),
    {
      id: QUESTION_TYPES_ID,
      audience: "staff" as const,
      title: t("components.title"),
      summary: "Every question type a form can use, with an example question JSON for each.",
      path: staffComponentsPath(),
    },
  ];
}

function renderGuide(audience: "staff" | "client", key: string): string {
  const ns = `${audience}.${key}`;
  const lines = [`# ${t(`${ns}.title`)}`, "", t(`${ns}.subtitle`)];
  for (const [section, { steps }] of Object.entries(raw[audience][key]!.sections)) {
    lines.push("", `## ${t(`${ns}.sections.${section}.heading`)}`, "", t(`${ns}.sections.${section}.body`));
    if (steps) lines.push("", ...steps.map((step, i) => `${i + 1}. ${step}`));
  }
  return lines.join("\n");
}

function renderQuestionTypes(): string {
  const lines = [
    `# ${t("components.title")}`,
    "",
    `## ${t("components.templateHeading")}`,
    "",
    t("components.templateBody"),
    "",
    `## ${t("components.repeatableHeading")}`,
    "",
    t("components.repeatableBody"),
  ];
  for (const entry of GALLERY) {
    lines.push(
      "",
      `## \`${entry.type}\` — ${entry.label}`,
      "",
      entry.description,
      "",
      "```json",
      JSON.stringify(entry.example, null, 2),
      "```",
    );
  }
  return lines.join("\n");
}

/** Markdown for one doc, or null for an unknown id. */
export function readDoc(id: string, origin: string): string | null {
  const summary = listDocs().find((doc) => doc.id === id);
  if (!summary) return null;
  const body =
    id === QUESTION_TYPES_ID
      ? renderQuestionTypes()
      : renderGuide(summary.audience, GUIDES.find((g) => g.id === id)!.key);
  return `${body}\n\nPage: ${origin}${summary.path}`;
}
