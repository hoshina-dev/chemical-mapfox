import { InternalNav } from "@/components/internal/InternalNav";

// Shared chrome for the whole experiment section (listing, workspace,
// onboarding). The admin gate lives in the parent /internal layout.
export default function ExperimentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <InternalNav />
      {children}
    </>
  );
}
