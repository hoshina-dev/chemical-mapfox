import { DocsGuide } from "@/components/docs/DocsGuide";

const SECTIONS = ["stages", "collab", "tabs"] as const;

export default function StaffDocsWorkspacePage() {
  return <DocsGuide namespace="docs.staff.workspace" sections={SECTIONS} />;
}
