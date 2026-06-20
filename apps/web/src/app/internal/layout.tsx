import { requireAdmin } from "@/lib/auth/dal";

// Server-side authorization backstop for everything under /internal/*.
// The middleware (proxy.ts) is the first gate; this ensures the admin check
// also runs in the render path, where it cannot be bypassed.
export default async function InternalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdmin();
  return <>{children}</>;
}
