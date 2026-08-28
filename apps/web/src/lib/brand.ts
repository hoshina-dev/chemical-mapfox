/** User-facing product / company identity. */
export const BRAND = {
  /** Short wordmark for nav, metadata, and compact chrome. */
  name: "Harper Analytics",
  /** Legal entity (Spółka z o.o.). */
  legalName: "Harper Analytics Sp. z o.o.",
  /** Optional tag beside the wordmark on marketing surfaces. */
  tagline: "Sp. z o.o.",
  email: "laboratorium@harperanalytics.com",
  /** Postal address; not translated. */
  address: "Harper Analytics Sp. z o.o.\nul. Dojazdowa 23\n43-100 Tychy",
  docsTitle: "Harper Analytics Docs",
  /** Sample-preparation conditions PDF on the public landing page. */
  termsPdfUrl:
    "https://files.harperanalytics.com/certificates/OGOLNE-WARUNKI-SWIADCZENIA-USLUG-01_08_2026.pdf",
} as const;
