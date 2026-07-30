/** Staff how-to + form component reference (admin-only). */
export const STAFF_DOCS_BASE = "/internal/docs";

/** Requester how-to guides (client-only). */
export const CLIENT_DOCS_BASE = "/experiment/docs";

export function staffDocsPath(slug?: string) {
  return slug ? `${STAFF_DOCS_BASE}/${slug}` : STAFF_DOCS_BASE;
}

export function clientDocsPath(slug?: string) {
  return slug ? `${CLIENT_DOCS_BASE}/${slug}` : CLIENT_DOCS_BASE;
}

export function staffComponentsPath() {
  return staffDocsPath("components");
}

export function staffComponentTypePath(type: string) {
  return staffDocsPath(type);
}
