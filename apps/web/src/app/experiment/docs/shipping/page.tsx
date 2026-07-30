import { DocsGuide } from "@/components/docs/DocsGuide";

const SECTIONS = ["label", "print", "arrival"] as const;

export default function ClientDocsShippingPage() {
  return <DocsGuide namespace="docs.client.shipping" sections={SECTIONS} />;
}
