import { DocsHub } from "@/components/docs/DocsHub";
import { CLIENT_DOC_GUIDES } from "@/lib/docs/nav";

export default function ClientDocsOverviewPage() {
  return (
    <DocsHub
      namespace="docs.client.overview"
      guides={CLIENT_DOC_GUIDES}
      linkNamespace="docs.sidebar.clientGuides"
    />
  );
}
