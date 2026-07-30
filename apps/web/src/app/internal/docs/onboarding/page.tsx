import { DocsGuide } from "@/components/docs/DocsGuide";

const SECTIONS = ["samples", "register", "templates", "next"] as const;

export default function StaffDocsOnboardingPage() {
  return <DocsGuide namespace="docs.staff.onboarding" sections={SECTIONS} />;
}
