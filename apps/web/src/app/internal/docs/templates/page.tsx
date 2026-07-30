import { DocsGuide } from "@/components/docs/DocsGuide";

const SECTIONS = [
  "create",
  "forms",
  "calculations",
  "preview",
  "save",
  "pdf",
  "components",
] as const;

export default function StaffDocsTemplatesPage() {
  return <DocsGuide namespace="docs.staff.templates" sections={SECTIONS} />;
}
