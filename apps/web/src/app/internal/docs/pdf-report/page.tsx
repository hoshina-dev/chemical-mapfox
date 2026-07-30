import { DocsGuide } from "@/components/docs/DocsGuide";

const SECTIONS = ["open", "canvas", "variables", "preview", "save"] as const;

export default function StaffDocsPdfReportPage() {
  return <DocsGuide namespace="docs.staff.pdfReport" sections={SECTIONS} />;
}
