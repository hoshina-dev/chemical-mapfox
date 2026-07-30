import { DocsGuide } from "@/components/docs/DocsGuide";

const SECTIONS = ["catalog", "intake", "after"] as const;

export default function ClientDocsRequestPage() {
  return <DocsGuide namespace="docs.client.request" sections={SECTIONS} />;
}
