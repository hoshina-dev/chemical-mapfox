import { DocsGuide } from "@/components/docs/DocsGuide";

const SECTIONS = [
  "connect",
  "consent",
  "unknownApp",
  "ask",
  "disconnect",
] as const;

export default function StaffDocsAiAssistantsPage() {
  return <DocsGuide namespace="docs.staff.aiAssistants" sections={SECTIONS} />;
}
