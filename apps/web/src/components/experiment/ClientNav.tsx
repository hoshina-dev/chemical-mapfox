"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChemFoxIcon } from "@/components/brand/ChemFoxMark";
import classes from "@/components/nav/nav.module.css";
import { UserMenu } from "@/components/UserMenu";
import type { CustApiRole } from "@/lib/auth/definitions";
import type { UserOrganization } from "@/lib/auth/organizations";
import {
  myExperimentsPath,
  requestCatalogPath,
} from "@/lib/experiment/routes";

const NAV_ITEMS = [
  { href: myExperimentsPath(), label: "My experiments" },
  { href: requestCatalogPath(), label: "Request experiment" },
];

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

  return (
    <header className={classes.clientShell}>
      <div className={classes.clientInner}>
        <div className={classes.leftCluster}>
          <Link href={myExperimentsPath()} className={classes.brand}>
            <ChemFoxIcon size={18} className={classes.brandIcon} />
            <span className={classes.clientBrandLabel}>ChemFox</span>
          </Link>
          <div className={classes.clientBrandDivider} aria-hidden />
          <nav className={classes.clientNavTrack} aria-label="Client">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${classes.clientLink}${active ? ` ${classes.clientLinkActive}` : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <UserMenu
          name={name}
          email={email}
          avatarUrl={avatarUrl}
          role={role}
          organizations={organizations}
          organizationPortalUrl={organizationPortalUrl}
        />
      </div>
    </header>
  );
}
