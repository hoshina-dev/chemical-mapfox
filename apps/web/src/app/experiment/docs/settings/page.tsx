import { DocsGuide } from "@/components/docs/DocsGuide";

const SECTIONS = ["where", "stages"] as const;

export default function ClientDocsSettingsPage() {
  return <DocsGuide namespace="docs.client.settings" sections={SECTIONS} />;
}
