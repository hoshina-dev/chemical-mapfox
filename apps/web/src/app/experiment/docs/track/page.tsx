import { DocsGuide } from "@/components/docs/DocsGuide";

const SECTIONS = ["board", "detail", "report"] as const;

export default function ClientDocsTrackPage() {
  return <DocsGuide namespace="docs.client.track" sections={SECTIONS} />;
}
