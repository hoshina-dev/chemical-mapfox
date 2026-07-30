import { DocsGuide } from "@/components/docs/DocsGuide";

const SECTIONS = ["flow", "report", "close"] as const;

export default function StaffDocsFinalizePage() {
  return <DocsGuide namespace="docs.staff.finalize" sections={SECTIONS} />;
}
