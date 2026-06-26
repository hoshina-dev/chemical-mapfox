"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChemFoxIcon } from "@/components/brand/ChemFoxMark";
import classes from "@/components/nav/nav.module.css";
import { UserMenu } from "@/components/UserMenu";
import type { CustApiRole } from "@/lib/auth/definitions";
import type { UserOrganization } from "@/lib/auth/organizations";
import {
  experimentListingPath,
  onboardingPath,
} from "@/lib/experiment-manager/routes";

const LISTING_PATH = experimentListingPath();

const NAV_ITEMS = [
  { href: LISTING_PATH, label: "Experiments" },
  { href: onboardingPath(), label: "Onboarding" },
  { href: "/internal/docs", label: "Docs" },
  { href: "/admin/users", label: "Users" },
];

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
}: {
  name: string;
  email?: string;
  avatarUrl?: string;
  role?: CustApiRole;
  organizations: UserOrganization[];
}) {
  const pathname = usePathname();

  return (
    <nav className={classes.staffShell} aria-label="Staff">
      <div className={classes.staffInner}>
        <div className={classes.leftCluster}>
          <Link href={LISTING_PATH} className={classes.brand}>
            <ChemFoxIcon className={classes.brandIcon} />
            <span className={classes.staffBrandLabel}>ChemFox</span>
          </Link>
          <div className={classes.navGroup}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${classes.staffLink}${active ? ` ${classes.staffLinkActive}` : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        <UserMenu
          name={name}
          email={email}
          avatarUrl={avatarUrl}
          role={role}
          organizations={organizations}
          variant="dark"
        />
      </div>
    </nav>
  );
}
