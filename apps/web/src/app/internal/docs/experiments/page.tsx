import { DocsGuide } from "@/components/docs/DocsGuide";

const SECTIONS = ["find", "open", "filters"] as const;

export default function StaffDocsExperimentsPage() {
  return <DocsGuide namespace="docs.staff.experiments" sections={SECTIONS} />;
}
