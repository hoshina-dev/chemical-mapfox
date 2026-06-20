import { Box } from "@mantine/core";
import type { Metadata } from "next";

import { DocsNavbar } from "@/components/docs/DocsNavbar";
import { GallerySidebar } from "@/components/docs/GallerySidebar";

export const metadata: Metadata = {
  title: "ChemFox Docs",
  description:
    "Reference for lab technicians building forms: every question type the form engine supports.",
};

export default function DocsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <DocsNavbar />
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          minHeight: "calc(100vh - 60px)",
        }}
      >
        <Box
          component="nav"
          style={{
            borderRight: "1px solid var(--mantine-color-default-border)",
            position: "sticky",
            top: 0,
            alignSelf: "start",
            height: "calc(100vh - 60px)",
          }}
        >
          <GallerySidebar />
        </Box>
        <Box component="main" p="xl">
          {children}
        </Box>
      </Box>
    </>
  );
}
