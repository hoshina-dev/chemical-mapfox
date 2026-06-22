"use client";

import { Anchor, Badge, Container, Group, Text } from "@mantine/core";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  isAdmin,
  roleLabel,
  type SessionUser,
} from "@/lib/auth/definitions";

import { LogoutButton } from "./LogoutButton";

const baseLinks = [{ href: "/dashboard", label: "Dashboard" }];
const adminLinks = [{ href: "/admin", label: "Lab Staff" }];

interface NavbarClientProps {
  user: SessionUser;
}

export function NavbarClient({ user }: NavbarClientProps) {
  const pathname = usePathname();
  const links = isAdmin(user.role)
    ? [...baseLinks, ...adminLinks]
    : baseLinks;

  return (
    <Container
      size="lg"
      py="sm"
      style={{
        borderBottom: "1px solid var(--mantine-color-default-border)",
      }}
    >
      <Group justify="space-between">
        <Group gap="lg">
          <Anchor
            component={Link}
            href="/dashboard"
            underline="never"
            c="inherit"
          >
            <Text fw={700}>Chemical Mapfox</Text>
          </Anchor>
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Anchor
                key={link.href}
                component={Link}
                href={link.href}
                c={active ? "blue.6" : "dimmed"}
                fw={active ? 600 : 400}
                underline="never"
              >
                {link.label}
              </Anchor>
            );
          })}
        </Group>
        <Group gap="sm">
          <Text size="sm" c="dimmed">
            {user.name}
          </Text>
          <Badge variant="light" color={isAdmin(user.role) ? "grape" : "blue"}>
            {roleLabel(user.role)}
          </Badge>
          <LogoutButton />
        </Group>
      </Group>
    </Container>
  );
}
