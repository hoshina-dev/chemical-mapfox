import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { DocsSidebar } from "@/components/docs/DocsSidebar";
import classes from "@/components/docs/docsShell.module.css";
import { CLIENT_DOC_GUIDES } from "@/lib/docs/nav";
import { BRAND } from "@/lib/brand";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("docs.layout");
  return {
    title: `${BRAND.name} · ${t("clientTitle")}`,
    description: t("clientDescription"),
  };
}

export default async function ClientDocsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const t = await getTranslations("docs.layout");

  return (
    <div className={classes.shell}>
      <nav className={classes.sidebar} aria-label={t("clientNavAriaLabel")}>
        <DocsSidebar
          guides={CLIENT_DOC_GUIDES}
          guideKeysNamespace="clientGuides"
        />
      </nav>
      <main className={classes.main}>{children}</main>
    </div>
  );
}
