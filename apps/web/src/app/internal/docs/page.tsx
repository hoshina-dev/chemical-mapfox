import { DocsHub } from "@/components/docs/DocsHub";
import { STAFF_DOC_GUIDES } from "@/lib/docs/nav";

export default function StaffDocsOverviewPage() {
  return (
    <DocsHub
      namespace="docs.staff.overview"
      guides={STAFF_DOC_GUIDES}
      linkNamespace="docs.sidebar.staffGuides"
    />
  );
}
