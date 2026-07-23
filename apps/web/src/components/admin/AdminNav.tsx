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
import type { UserOrganization } from "@/lib/auth/organizations";
import { BRAND } from "@/lib/brand";
import {
  experimentListingPath,
  onboardingPath,
} from "@/lib/experiment-manager/routes";

const LISTING_PATH = experimentListingPath();

const NAV_ITEMS = [
  { href: LISTING_PATH, key: "experiments" },
  { href: onboardingPath(), key: "onboarding" },
  { href: "/internal/docs", key: "docs" },
  { href: "/admin/users", key: "users" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === LISTING_PATH) {
    return (
      pathname === LISTING_PATH ||
      (pathname.startsWith("/internal/experiment") &&
        !pathname.startsWith("/internal/experiment/onboarding"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({
  name,
  email,
  avatarUrl,
  role,
  organizations,
  organizationPortalUrl,
}: {
  name: string;
  email?: string;
  avatarUrl?: string;
  role?: CustApiRole;
  organizations: UserOrganization[];
  organizationPortalUrl: string;
}) {
  const pathname = usePathname();
  const t = useTranslations("staff.nav");

  return (
    <nav className={classes.staffShell} aria-label={t("staffAriaLabel")}>
      <div className={classes.staffInner}>
        <div className={classes.leftCluster}>
          <Link href={LISTING_PATH} className={classes.brand}>
            <BrandIcon size={18} className={classes.brandIcon} />
            <span className={classes.staffBrandLabel}>{BRAND.name}</span>
          </Link>
          <div className={classes.staffBrandDivider} aria-hidden />
          <div
            className={classes.staffNavTrack}
            role="navigation"
            aria-label={t("staffSectionsAriaLabel")}
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${classes.staffLink}${active ? ` ${classes.staffLinkActive}` : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </div>
        </div>
        <Group gap="sm" wrap="nowrap">
          <LanguageSwitcher variant="dark" />
          <UserMenu
            name={name}
            email={email}
            avatarUrl={avatarUrl}
            role={role}
            organizations={organizations}
            organizationPortalUrl={organizationPortalUrl}
            variant="dark"
          />
        </Group>
      </div>
    </nav>
  );
}
