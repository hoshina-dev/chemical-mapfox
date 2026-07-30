"use client";

import { Group } from "@mantine/core";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandIcon } from "@/components/brand/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import classes from "@/components/nav/nav.module.css";
import { UserMenu } from "@/components/UserMenu";
import type { CustApiRole } from "@/lib/auth/definitions";
import { BRAND } from "@/lib/brand";
import {
  myExperimentsPath,
  requestCatalogPath,
  settingsPath,
} from "@/lib/experiment/routes";

const NAV_ITEMS = [
  { href: myExperimentsPath(), key: "myExperiments" },
  { href: requestCatalogPath(), key: "requestExperiment" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === myExperimentsPath()) {
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) &&
        !pathname.startsWith(requestCatalogPath()))
    );
  }
  return pathname.startsWith("/experiment/request");
}

export function ClientNav({
  name,
  email,
  avatarUrl,
  role,
}: {
  name: string;
  email?: string;
  avatarUrl?: string;
  role?: CustApiRole;
}) {
  const pathname = usePathname();
  const t = useTranslations("experiment.nav");

  return (
    <header className={classes.clientShell}>
      <div className={classes.clientInner}>
        <div className={classes.leftCluster}>
          <Link href={myExperimentsPath()} className={classes.brand}>
            <BrandIcon size={18} className={classes.brandIcon} />
            <span className={classes.clientBrandLabel}>{BRAND.name}</span>
          </Link>
          <div className={classes.clientBrandDivider} aria-hidden />
          <nav
            className={classes.clientNavTrack}
            aria-label={t("clientAriaLabel")}
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${classes.clientLink}${active ? ` ${classes.clientLinkActive}` : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
        </div>
        <Group gap="sm" wrap="nowrap">
          <LanguageSwitcher />
          <UserMenu
            name={name}
            email={email}
            avatarUrl={avatarUrl}
            role={role}
            settingsHref={settingsPath()}
          />
        </Group>
      </div>
    </header>
  );
}
