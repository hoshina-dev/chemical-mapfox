import {
  CLIENT_DOCS_BASE,
  STAFF_DOCS_BASE,
  clientDocsPath,
  staffDocsPath,
} from "./routes";

export type DocsNavItem = {
  href: string;
  /** Message key under docs.sidebar.staffGuides / clientGuides */
  key: string;
};

/** Staff guide pages (component gallery types stay at /internal/docs/{type}). */
export const STAFF_DOC_GUIDES: readonly DocsNavItem[] = [
  { href: STAFF_DOCS_BASE, key: "overview" },
  { href: staffDocsPath("experiments"), key: "experiments" },
  { href: staffDocsPath("check-in"), key: "checkIn" },
  { href: staffDocsPath("workspace"), key: "workspace" },
  { href: staffDocsPath("finalize"), key: "finalize" },
  { href: staffDocsPath("onboarding"), key: "onboarding" },
  { href: staffDocsPath("templates"), key: "templates" },
  { href: staffDocsPath("pdf-report"), key: "pdfReport" },
  { href: staffDocsPath("components"), key: "components" },
] as const;

export const CLIENT_DOC_GUIDES: readonly DocsNavItem[] = [
  { href: CLIENT_DOCS_BASE, key: "overview" },
  { href: clientDocsPath("request"), key: "request" },
  { href: clientDocsPath("track"), key: "track" },
  { href: clientDocsPath("shipping"), key: "shipping" },
  { href: clientDocsPath("settings"), key: "settings" },
] as const;

/** Static path segments reserved for staff guides (not gallery question types). */
export const STAFF_DOC_RESERVED_SLUGS = new Set(
  STAFF_DOC_GUIDES.map((item) => {
    const rest = item.href.slice(STAFF_DOCS_BASE.length);
    return rest.startsWith("/") ? rest.slice(1) : rest;
  }).filter(Boolean),
);
