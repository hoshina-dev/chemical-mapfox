import { DocsGuide } from "@/components/docs/DocsGuide";

const SECTIONS = ["when", "how", "after"] as const;

export default function StaffDocsCheckInPage() {
  return <DocsGuide namespace="docs.staff.checkIn" sections={SECTIONS} />;
}
