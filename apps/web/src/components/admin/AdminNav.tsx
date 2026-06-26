"use client";

import { Box, Group, Text } from "@mantine/core";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserMenu } from "@/components/UserMenu";
import type { CustApiRole } from "@/lib/auth/definitions";
import type { UserOrganization } from "@/lib/auth/organizations";
import { onboardingPath } from "@/lib/experiment-manager/routes";

const NAV_ITEMS = [
  { href: "/admin", label: "Experiments" },
  { href: onboardingPath(), label: "Onboarding" },
  { href: "/internal/docs", label: "Docs" },
  { href: "/admin/users", label: "Users" },
];

function isActive(pathname: string, href: string): boolean {
  // "Experiments" also owns the workspace/raw/checkin routes under
  // /internal/experiment/* (just not the onboarding subtree, which has its
  // own tab).
  if (href === "/admin") {
    return (
      pathname === "/admin" ||
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
    <Box
      component="nav"
      style={{
        background: "#111318",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <Group
        justify="space-between"
        wrap="nowrap"
        h={54}
        px="lg"
        style={{ maxWidth: 1280, margin: "0 auto" }}
      >
        <Group gap={20} wrap="nowrap">
          {/* Intentionally not a link for now — see chat for context. */}
          <Box
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              flexShrink: 0,
            }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2f9e44"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
            <Text fw={700} size="sm" c="white">
              ChemFox
            </Text>
          </Box>
          <Group gap={0} h={54} wrap="nowrap">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Box
                  key={item.href}
                  component={Link}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    padding: "0 14px",
                    fontSize: 14,
                    fontWeight: 500,
                    color: active ? "#fff" : "rgba(255,255,255,.45)",
                    textDecoration: "none",
                    borderBottom: active
                      ? "2px solid #2f9e44"
                      : "2px solid transparent",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </Box>
              );
            })}
          </Group>
        </Group>
        <UserMenu
          name={name}
          email={email}
          avatarUrl={avatarUrl}
          role={role}
          organizations={organizations}
          variant="dark"
        />
      </Group>
    </Box>
  );
}
