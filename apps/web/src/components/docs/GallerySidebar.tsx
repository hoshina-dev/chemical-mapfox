"use client";

import { GALLERY } from "@repo/forms";
import { NavLink, ScrollArea, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

const DOCS_BASE = "/internal/docs";

export function GallerySidebar() {
  const pathname = usePathname();
  const t = useTranslations("docs");

  return (
    <ScrollArea h="100%">
      <Stack gap={4} p="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>
          {t("sidebar.components")}
        </Text>
        {GALLERY.map((entry) => {
          const href = `${DOCS_BASE}/${entry.type}`;
          const active = pathname === href || pathname === `${href}/`;
          return (
            <NavLink
              key={entry.type}
              component={Link}
              href={href}
              active={active}
              label={t(`gallery.${entry.type}.label`)}
              description={entry.type}
              variant={active ? "filled" : "subtle"}
            />
          );
        })}
      </Stack>
    </ScrollArea>
  );
}
