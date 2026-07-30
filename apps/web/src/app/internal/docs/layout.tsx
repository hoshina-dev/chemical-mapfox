import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { DocsSidebar } from "@/components/docs/DocsSidebar";
import classes from "@/components/docs/docsShell.module.css";
import { STAFF_DOC_GUIDES } from "@/lib/docs/nav";
import { BRAND } from "@/lib/brand";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("docs.layout");
  return {
    title: BRAND.docsTitle,
    description: t("description"),
  };
}

export default async function DocsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const t = await getTranslations("docs.layout");

  return (
    <div className={classes.shell}>
      <nav className={classes.sidebar} aria-label={t("navAriaLabel")}>
        <DocsSidebar
          guides={STAFF_DOC_GUIDES}
          guideKeysNamespace="staffGuides"
          showComponentGallery
        />
      </nav>
      <main className={classes.main}>{children}</main>
    </div>
  );
}
